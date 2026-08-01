import 'dotenv/config';
import type { Server } from 'http';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { getDataSourceToken } from '@nestjs/typeorm';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../../../src/app.module';
import { TimezoneInterceptor } from '../../../src/common/interceptors/timezone.interceptor';
import { LoginResponse } from '../../../src/modules/auth/services/auth.service';
import { RefreshToken } from '../../../src/modules/auth/entities/refresh-token.entity';
import { UserResponseDto } from '../../../src/modules/user/dtos/user-response.dto';
import { User } from '../../../src/modules/user/entities/user.entity';
import { login } from '../../global/auth-helpers';
import {
  getTestDataSource,
  resetTestDataSource,
  closeTestDataSource,
} from '../../global/db-context';

describe('AuthController (integration)', () => {
  let app: INestApplication;
  let httpServer: Server;
  let dataSource: DataSource;

  beforeAll(async () => {
    dataSource = await getTestDataSource();

    // Feed AppModule the already-connected test DataSource directly instead of
    // letting its TypeOrmModule.forRootAsync factory open its own connection.
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(getDataSourceToken())
      .useValue(dataSource)
      .compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }),
    );
    app.useGlobalInterceptors(new TimezoneInterceptor());
    await app.init();
    httpServer = app.getHttpServer() as Server;
  });

  beforeEach(async () => {
    await resetTestDataSource();
  });

  afterAll(async () => {
    await app.close();
    await closeTestDataSource();
  });

  describe('POST /auth/login', () => {
    describe('GIVEN a seeded, active user with the correct password', () => {
      it('THEN should respond 201 with an access token, a refresh token, and the user profile', async () => {
        const response = await login(httpServer, 'nurse01', 'Nurse@123');

        expect(response.status).toBe(201);
        const body = response.body as LoginResponse;
        expect(typeof body.accessToken).toBe('string');
        expect(typeof body.refreshToken).toBe('string');
        expect(body.user).toEqual(
          expect.objectContaining({
            id: 3,
            username: 'nurse01',
            fullName: 'Điều dưỡng 01',
            roles: ['Nurse'],
            isActive: true,
          }),
        );
      });

      it('THEN should persist the issued refresh token against that user', async () => {
        const response = await login(httpServer, 'nurse01', 'Nurse@123');
        const { refreshToken } = response.body as LoginResponse;

        const stored = await dataSource
          .getRepository(RefreshToken)
          .findOne({ where: { token: refreshToken } });

        expect(stored).not.toBeNull();
        expect(stored?.userId).toBe(3);
      });
    });

    describe('GIVEN an incorrect password', () => {
      it('THEN should respond 401 Unauthorized', async () => {
        const response = await login(httpServer, 'nurse01', 'wrong-password');

        expect(response.status).toBe(401);
      });
    });

    describe('GIVEN a username that does not exist', () => {
      it('THEN should respond 401 Unauthorized', async () => {
        const response = await login(httpServer, 'no-such-user', 'whatever');

        expect(response.status).toBe(401);
      });
    });

    describe('GIVEN the account has been deactivated', () => {
      beforeEach(async () => {
        await dataSource.getRepository(User).update({ username: 'nurse01' }, { isActive: false });
      });

      it('THEN should respond 401 Unauthorized', async () => {
        const response = await login(httpServer, 'nurse01', 'Nurse@123');

        expect(response.status).toBe(401);
      });
    });

    describe('GIVEN the request body is missing the password field', () => {
      it('THEN should respond 400 Bad Request', async () => {
        const response = await request(httpServer)
          .post('/auth/login')
          .send({ username: 'nurse01' });

        expect(response.status).toBe(400);
      });
    });
  });

  describe('POST /auth/refresh', () => {
    describe('GIVEN a refresh token issued at login', () => {
      it('THEN should respond 201 with a new access token', async () => {
        const loginResponse = await login(httpServer, 'nurse01', 'Nurse@123');
        const { refreshToken } = loginResponse.body as LoginResponse;

        const response = await request(httpServer).post('/auth/refresh').send({ refreshToken });

        expect(response.status).toBe(201);
        expect(typeof (response.body as { accessToken: string }).accessToken).toBe('string');
      });
    });

    describe('GIVEN a malformed refresh token', () => {
      it('THEN should respond 401 Unauthorized', async () => {
        const response = await request(httpServer)
          .post('/auth/refresh')
          .send({ refreshToken: 'not-a-real-token' });

        expect(response.status).toBe(401);
      });
    });

    describe('GIVEN a refresh token that has already been logged out', () => {
      it('THEN should respond 401 Unauthorized', async () => {
        const loginResponse = await login(httpServer, 'nurse01', 'Nurse@123');
        const { refreshToken } = loginResponse.body as LoginResponse;
        await request(httpServer).post('/auth/logout').send({ refreshToken });

        const response = await request(httpServer).post('/auth/refresh').send({ refreshToken });

        expect(response.status).toBe(401);
      });
    });

    describe('GIVEN a refresh token that is signed correctly but has expired in storage', () => {
      it('THEN should respond 401 Unauthorized', async () => {
        const loginResponse = await login(httpServer, 'nurse01', 'Nurse@123');
        const { refreshToken } = loginResponse.body as LoginResponse;
        await dataSource
          .getRepository(RefreshToken)
          .update({ token: refreshToken }, { expiresAt: new Date(Date.now() - 1000) });

        const response = await request(httpServer).post('/auth/refresh').send({ refreshToken });

        expect(response.status).toBe(401);
      });
    });
  });

  describe('POST /auth/logout', () => {
    describe('GIVEN a refresh token issued at login', () => {
      it('THEN should respond 201 with success true', async () => {
        const loginResponse = await login(httpServer, 'nurse01', 'Nurse@123');
        const { refreshToken } = loginResponse.body as LoginResponse;

        const response = await request(httpServer).post('/auth/logout').send({ refreshToken });

        expect(response.status).toBe(201);
        expect(response.body).toEqual({ success: true });
      });

      // Kept separate from the response-shape assertion above: this is verifying
      // persistence, a different system than "did the HTTP response look right."
      it('THEN should remove the refresh token from storage', async () => {
        const loginResponse = await login(httpServer, 'nurse01', 'Nurse@123');
        const { refreshToken } = loginResponse.body as LoginResponse;

        await request(httpServer).post('/auth/logout').send({ refreshToken });

        const stored = await dataSource
          .getRepository(RefreshToken)
          .findOne({ where: { token: refreshToken } });
        expect(stored).toBeNull();
      });
    });
  });

  describe('GET /auth/me', () => {
    describe('GIVEN no Authorization header is present', () => {
      it('THEN should respond 401 Unauthorized', async () => {
        const response = await request(httpServer).get('/auth/me');

        expect(response.status).toBe(401);
      });
    });

    describe('GIVEN the Authorization header carries an invalid token', () => {
      it('THEN should respond 401 Unauthorized', async () => {
        const response = await request(httpServer)
          .get('/auth/me')
          .set('Authorization', 'Bearer not-a-real-token');

        expect(response.status).toBe(401);
      });
    });

    describe('GIVEN a valid access token for a seeded, active user', () => {
      it("THEN should respond 200 with that user's profile", async () => {
        const loginResponse = await login(httpServer, 'nurse01', 'Nurse@123');
        const { accessToken } = loginResponse.body as LoginResponse;

        const response = await request(httpServer)
          .get('/auth/me')
          .set('Authorization', `Bearer ${accessToken}`);

        expect(response.status).toBe(200);
        expect(response.body as UserResponseDto).toEqual(
          expect.objectContaining({
            id: 3,
            username: 'nurse01',
            fullName: 'Điều dưỡng 01',
            caseId: null,
            roles: ['Nurse'],
            isActive: true,
          }),
        );
      });
    });

    describe('GIVEN a valid access token but the user was deactivated after it was issued', () => {
      it('THEN should respond 401 Unauthorized', async () => {
        const loginResponse = await login(httpServer, 'nurse01', 'Nurse@123');
        const { accessToken } = loginResponse.body as LoginResponse;
        await dataSource.getRepository(User).update({ username: 'nurse01' }, { isActive: false });

        const response = await request(httpServer)
          .get('/auth/me')
          .set('Authorization', `Bearer ${accessToken}`);

        expect(response.status).toBe(401);
      });
    });
  });
});
