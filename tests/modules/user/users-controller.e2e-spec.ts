import 'dotenv/config';
import type { Server } from 'http';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { getDataSourceToken } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../../../src/app.module';
import { TimezoneInterceptor } from '../../../src/common/interceptors/timezone.interceptor';
import { LoginResponse } from '../../../src/modules/auth/services/auth.service';
import { UserResponseDto } from '../../../src/modules/user/dtos/user-response.dto';
import { User } from '../../../src/modules/user/entities/user.entity';
import { UserRoleName } from '../../../src/modules/user/enums/user-role.enum';
import { authed, login } from '../../global/auth-helpers';
import {
  getTestDataSource,
  resetTestDataSource,
  closeTestDataSource,
} from '../../global/db-context';

// UsersController#findAll returns raw User entities (nested { id, roleName }
// role objects), not the flattened UserResponseDto shape GET /users/:id uses.
interface FindAllResponse {
  data: (Omit<UserResponseDto, 'roles'> & { roles: { id: number; roleName: string }[] })[];
  total: number;
  page: number;
  limit: number;
}

describe('UsersController (integration)', () => {
  let app: INestApplication;
  let httpServer: Server;
  let dataSource: DataSource;
  let adminToken: string;

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

    const loginResponse = await login(httpServer, UserRoleName.ADMIN);
    adminToken = (loginResponse.body as LoginResponse).accessToken;
  });

  afterAll(async () => {
    await app.close();
    await closeTestDataSource();
  });

  describe('POST /users', () => {
    describe('GIVEN an authenticated caller and a new, unique username', () => {
      it('THEN should respond 201 with the created user, roles defaulted to Nurse', async () => {
        const response = await authed(request(httpServer).post('/users'), adminToken).send({
          username: 'newnurse',
          password: 'Abc@12345',
          fullName: 'Nguyễn Văn Mới',
        });

        expect(response.status).toBe(201);
        expect(response.body as UserResponseDto).toEqual(
          expect.objectContaining({
            username: 'newnurse',
            fullName: 'Nguyễn Văn Mới',
            phoneNumber: null,
            roles: ['Nurse'],
            isActive: true,
          }),
        );
      });

      it('THEN should not include a password hash anywhere in the response body', async () => {
        const response = await authed(request(httpServer).post('/users'), adminToken).send({
          username: 'newnurse',
          password: 'Abc@12345',
          fullName: 'Nguyễn Văn Mới',
        });

        expect(response.body).not.toHaveProperty('passwordHash');
        expect(response.body).not.toHaveProperty('password_hash');
      });

      // Kept separate from the response-shape assertions above: this is verifying
      // persistence, a different system than "did the HTTP response look right."
      it('THEN should persist the password as a bcrypt hash, not plaintext', async () => {
        await authed(request(httpServer).post('/users'), adminToken).send({
          username: 'newnurse',
          password: 'Abc@12345',
          fullName: 'Nguyễn Văn Mới',
        });

        const stored = await dataSource
          .getRepository(User)
          .findOne({ where: { username: 'newnurse' } });

        expect(stored?.passwordHash).not.toBe('Abc@12345');
        await expect(bcrypt.compare('Abc@12345', stored?.passwordHash ?? '')).resolves.toBe(true);
      });
    });

    describe('GIVEN the username is already taken by a seeded user', () => {
      it('THEN should respond 409 Conflict', async () => {
        const response = await authed(request(httpServer).post('/users'), adminToken).send({
          username: 'nurse01',
          password: 'Abc@12345',
          fullName: 'Trùng Tên',
        });

        expect(response.status).toBe(409);
      });
    });

    describe('GIVEN the password does not meet the complexity policy', () => {
      it('THEN should respond 400 Bad Request', async () => {
        const response = await authed(request(httpServer).post('/users'), adminToken).send({
          username: 'weakpassuser',
          password: 'weak',
          fullName: 'Yếu Mật Khẩu',
        });

        expect(response.status).toBe(400);
      });
    });

    describe('GIVEN the request is missing the required fullName field', () => {
      it('THEN should respond 400 Bad Request', async () => {
        const response = await authed(request(httpServer).post('/users'), adminToken).send({
          username: 'nofullname',
          password: 'Abc@12345',
        });

        expect(response.status).toBe(400);
      });
    });

    describe('GIVEN no Authorization header is present', () => {
      it('THEN should respond 401 Unauthorized', async () => {
        const response = await request(httpServer).post('/users').send({
          username: 'unauthed',
          password: 'Abc@12345',
          fullName: 'Không Xác Thực',
        });

        expect(response.status).toBe(401);
      });
    });
  });

  describe('GET /users', () => {
    describe('GIVEN no filters', () => {
      it('THEN should respond 200 with the full seeded user set, paginated', async () => {
        const response = await authed(request(httpServer).get('/users'), adminToken);

        expect(response.status).toBe(200);
        const body = response.body as FindAllResponse;
        expect(body.total).toBe(13);
        expect(body.page).toBe(1);
        expect(body.limit).toBe(10);
        expect(body.data).toHaveLength(10);
      });
    });

    describe('GIVEN a role filter of Patient', () => {
      it('THEN should respond 200 with only patient-role users', async () => {
        const response = await authed(
          request(httpServer).get('/users').query({ role: 'Patient' }),
          adminToken,
        );

        expect(response.status).toBe(200);
        const body = response.body as FindAllResponse;
        expect(body.total).toBe(10);
        expect(body.data.every((u) => u.roles.some((r) => r.roleName === 'Patient'))).toBe(true);
      });
    });

    describe('GIVEN a search filter matching one seeded full name', () => {
      it('THEN should respond 200 with only that user', async () => {
        const response = await authed(
          request(httpServer).get('/users').query({ search: 'Minh Đức' }),
          adminToken,
        );

        expect(response.status).toBe(200);
        const body = response.body as FindAllResponse;
        expect(body.total).toBe(1);
        expect(body.data[0]).toEqual(expect.objectContaining({ username: 'patient05' }));
      });
    });

    describe('GIVEN a pagination limit smaller than the total user count', () => {
      it('THEN should respond 200 with a page of that size and the correct total', async () => {
        const response = await authed(
          request(httpServer).get('/users').query({ page: 1, limit: 5 }),
          adminToken,
        );

        expect(response.status).toBe(200);
        const body = response.body as FindAllResponse;
        expect(body.data).toHaveLength(5);
        expect(body.total).toBe(13);
      });
    });

    describe('GIVEN an isActive=false filter and one deactivated seeded user', () => {
      beforeEach(async () => {
        await dataSource.getRepository(User).update({ username: 'nurse01' }, { isActive: false });
      });

      it('THEN should respond 200 with only that deactivated user', async () => {
        const response = await authed(
          request(httpServer).get('/users').query({ isActive: false }),
          adminToken,
        );

        expect(response.status).toBe(200);
        const body = response.body as FindAllResponse;
        expect(body.total).toBe(1);
        expect(body.data[0]).toEqual(expect.objectContaining({ username: 'nurse01' }));
      });
    });

    describe('GIVEN no Authorization header is present', () => {
      it('THEN should respond 401 Unauthorized', async () => {
        const response = await request(httpServer).get('/users');

        expect(response.status).toBe(401);
      });
    });
  });

  describe('GET /users/:id', () => {
    describe('GIVEN a seeded user id', () => {
      it("THEN should respond 200 with that user's profile", async () => {
        const response = await authed(request(httpServer).get('/users/3'), adminToken);

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

    describe('GIVEN an id that does not exist', () => {
      it('THEN should respond 404 Not Found', async () => {
        const response = await authed(request(httpServer).get('/users/999999'), adminToken);

        expect(response.status).toBe(404);
      });
    });

    describe('GIVEN no Authorization header is present', () => {
      it('THEN should respond 401 Unauthorized', async () => {
        const response = await request(httpServer).get('/users/3');

        expect(response.status).toBe(401);
      });
    });
  });

  describe('PATCH /users/:id', () => {
    describe('GIVEN a seeded user id and new fullName/phoneNumber', () => {
      it('THEN should respond 200 with the updated fields', async () => {
        const response = await authed(request(httpServer).patch('/users/3'), adminToken).send({
          fullName: 'Điều dưỡng Cập Nhật',
          phoneNumber: '0909090909',
        });

        expect(response.status).toBe(200);
        expect(response.body as UserResponseDto).toEqual(
          expect.objectContaining({
            id: 3,
            fullName: 'Điều dưỡng Cập Nhật',
            phoneNumber: '0909090909',
          }),
        );
      });

      it('THEN should persist the updated fullName', async () => {
        await authed(request(httpServer).patch('/users/3'), adminToken).send({
          fullName: 'Điều dưỡng Cập Nhật',
        });

        const stored = await dataSource.getRepository(User).findOne({ where: { id: 3 } });
        expect(stored?.fullName).toBe('Điều dưỡng Cập Nhật');
      });
    });

    describe('GIVEN a new password', () => {
      it('THEN should persist a new bcrypt hash that verifies the new password and rejects the old one', async () => {
        const before = await dataSource.getRepository(User).findOne({ where: { id: 3 } });

        await authed(request(httpServer).patch('/users/3'), adminToken).send({
          password: 'NewPass@99',
        });

        const after = await dataSource.getRepository(User).findOne({ where: { id: 3 } });
        expect(after?.passwordHash).not.toBe(before?.passwordHash);
        await expect(bcrypt.compare('NewPass@99', after?.passwordHash ?? '')).resolves.toBe(true);
        await expect(bcrypt.compare('Nurse@123', after?.passwordHash ?? '')).resolves.toBe(false);
      });
    });

    describe('GIVEN new roles', () => {
      it('THEN should respond 200 with the roles replaced', async () => {
        const response = await authed(request(httpServer).patch('/users/3'), adminToken).send({
          roles: ['Head_Nurse'],
        });

        expect(response.status).toBe(200);
        expect((response.body as UserResponseDto).roles).toEqual(['Head_Nurse']);
      });
    });

    describe('GIVEN the new username is already taken by another seeded user', () => {
      it('THEN should respond 409 Conflict', async () => {
        const response = await authed(request(httpServer).patch('/users/3'), adminToken).send({
          username: 'admin',
        });

        expect(response.status).toBe(409);
      });
    });

    describe('GIVEN an id that does not exist', () => {
      it('THEN should respond 404 Not Found', async () => {
        const response = await authed(request(httpServer).patch('/users/999999'), adminToken).send({
          fullName: 'Không Tồn Tại',
        });

        expect(response.status).toBe(404);
      });
    });

    describe('GIVEN no Authorization header is present', () => {
      it('THEN should respond 401 Unauthorized', async () => {
        const response = await request(httpServer)
          .patch('/users/3')
          .send({ fullName: 'Không Xác Thực' });

        expect(response.status).toBe(401);
      });
    });
  });

  describe('DELETE /users/:id', () => {
    describe('GIVEN a seeded, active user id', () => {
      it('THEN should respond 200 with the user marked inactive', async () => {
        const response = await authed(request(httpServer).delete('/users/3'), adminToken);

        expect(response.status).toBe(200);
        expect((response.body as UserResponseDto).isActive).toBe(false);
      });

      // Kept separate from the response-shape assertion above: this is verifying
      // persistence, a different system than "did the HTTP response look right."
      it('THEN should persist the deactivation as a soft delete, not a row removal', async () => {
        await authed(request(httpServer).delete('/users/3'), adminToken);

        const stored = await dataSource.getRepository(User).findOne({ where: { id: 3 } });
        expect(stored).not.toBeNull();
        expect(stored?.isActive).toBe(false);
      });
    });

    describe('GIVEN an id that does not exist', () => {
      it('THEN should respond 404 Not Found', async () => {
        const response = await authed(request(httpServer).delete('/users/999999'), adminToken);

        expect(response.status).toBe(404);
      });
    });

    describe('GIVEN no Authorization header is present', () => {
      it('THEN should respond 401 Unauthorized', async () => {
        const response = await request(httpServer).delete('/users/3');

        expect(response.status).toBe(401);
      });
    });
  });
});
