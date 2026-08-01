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
import {
  NurseResponseDto,
  PaginatedNursesDto,
} from '../../../src/modules/nurse/dtos/nurse-response.dto';
import { NurseStats } from '../../../src/modules/nurse/repositories/nurse.repository';
import { User } from '../../../src/modules/user/entities/user.entity';
import { UserRoleName } from '../../../src/modules/user/enums/user-role.enum';
import { authed, login } from '../../global/auth-helpers';
import {
  getTestDataSource,
  resetTestDataSource,
  closeTestDataSource,
} from '../../global/db-context';

describe('NurseController (integration)', () => {
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

  describe('GET /nurses/stats', () => {
    describe('GIVEN the two seeded nurse accounts are both active', () => {
      it('THEN should respond 200 with total 2, active 2, inactive 0', async () => {
        const response = await authed(request(httpServer).get('/nurses/stats'), adminToken);

        expect(response.status).toBe(200);
        expect(response.body as NurseStats).toEqual({ total: 2, active: 2, inactive: 0 });
      });
    });

    describe('GIVEN one seeded nurse has been deactivated', () => {
      beforeEach(async () => {
        await dataSource.getRepository(User).update({ username: 'nurse01' }, { isActive: false });
      });

      it('THEN should respond 200 with active 1 and inactive 1', async () => {
        const response = await authed(request(httpServer).get('/nurses/stats'), adminToken);

        expect(response.status).toBe(200);
        expect(response.body as NurseStats).toEqual({ total: 2, active: 1, inactive: 1 });
      });
    });

    describe('GIVEN no Authorization header is present', () => {
      it('THEN should respond 401 Unauthorized', async () => {
        const response = await request(httpServer).get('/nurses/stats');

        expect(response.status).toBe(401);
      });
    });
  });

  describe('GET /nurses', () => {
    describe('GIVEN no filters', () => {
      it('THEN should respond 200 with both seeded nurse accounts', async () => {
        const response = await authed(request(httpServer).get('/nurses'), adminToken);

        expect(response.status).toBe(200);
        const body = response.body as PaginatedNursesDto;
        expect(body.total).toBe(2);
        expect(body.page).toBe(1);
        expect(body.limit).toBe(10);
        expect(body.data.map((n) => n.username).sort()).toEqual(['head_nurse', 'nurse01']);
      });
    });

    describe('GIVEN a search filter matching only the head nurse full name', () => {
      it('THEN should respond 200 with only that nurse', async () => {
        const response = await authed(
          request(httpServer).get('/nurses').query({ search: 'trưởng' }),
          adminToken,
        );

        expect(response.status).toBe(200);
        const body = response.body as PaginatedNursesDto;
        expect(body.total).toBe(1);
        expect(body.data[0]).toEqual(expect.objectContaining({ username: 'head_nurse' }));
      });
    });

    describe('GIVEN an isActive=false filter and one deactivated seeded nurse', () => {
      beforeEach(async () => {
        await dataSource.getRepository(User).update({ username: 'nurse01' }, { isActive: false });
      });

      it('THEN should respond 200 with only that deactivated nurse', async () => {
        const response = await authed(
          request(httpServer).get('/nurses').query({ isActive: false }),
          adminToken,
        );

        expect(response.status).toBe(200);
        const body = response.body as PaginatedNursesDto;
        expect(body.total).toBe(1);
        expect(body.data[0]).toEqual(
          expect.objectContaining({ username: 'nurse01', isActive: false }),
        );
      });
    });

    describe('GIVEN a pagination limit smaller than the total nurse count', () => {
      it('THEN should respond 200 with a page of that size and the correct total', async () => {
        const response = await authed(
          request(httpServer).get('/nurses').query({ page: 1, limit: 1 }),
          adminToken,
        );

        expect(response.status).toBe(200);
        const body = response.body as PaginatedNursesDto;
        expect(body.data).toHaveLength(1);
        expect(body.total).toBe(2);
      });
    });

    describe('GIVEN no Authorization header is present', () => {
      it('THEN should respond 401 Unauthorized', async () => {
        const response = await request(httpServer).get('/nurses');

        expect(response.status).toBe(401);
      });
    });
  });

  describe('GET /nurses/:id', () => {
    describe('GIVEN a seeded nurse id', () => {
      it("THEN should respond 200 with that nurse's profile", async () => {
        const response = await authed(request(httpServer).get('/nurses/3'), adminToken);

        expect(response.status).toBe(200);
        expect(response.body as NurseResponseDto).toEqual(
          expect.objectContaining({
            id: 3,
            username: 'nurse01',
            fullName: 'Điều dưỡng 01',
            roles: ['Nurse'],
            isActive: true,
          }),
        );
      });
    });

    describe('GIVEN an id that belongs to a seeded user who is not a nurse', () => {
      it('THEN should respond 404 Not Found', async () => {
        const response = await authed(request(httpServer).get('/nurses/4'), adminToken);

        expect(response.status).toBe(404);
      });
    });

    describe('GIVEN an id that does not exist', () => {
      it('THEN should respond 404 Not Found', async () => {
        const response = await authed(request(httpServer).get('/nurses/999999'), adminToken);

        expect(response.status).toBe(404);
      });
    });

    describe('GIVEN no Authorization header is present', () => {
      it('THEN should respond 401 Unauthorized', async () => {
        const response = await request(httpServer).get('/nurses/3');

        expect(response.status).toBe(401);
      });
    });
  });

  describe('POST /nurses', () => {
    describe('GIVEN a unique username and a Nurse role', () => {
      it('THEN should respond 201 with the created nurse', async () => {
        const response = await authed(request(httpServer).post('/nurses'), adminToken).send({
          username: 'nurse02',
          password: 'Nurse@123',
          fullName: 'Điều dưỡng 02',
          role: UserRoleName.NURSE,
        });

        expect(response.status).toBe(201);
        expect(response.body as NurseResponseDto).toEqual(
          expect.objectContaining({
            username: 'nurse02',
            fullName: 'Điều dưỡng 02',
            phoneNumber: null,
            roles: ['Nurse'],
            isActive: true,
          }),
        );
      });

      // Kept separate from the response-shape assertion above: this is verifying
      // persistence, a different system than "did the HTTP response look right."
      it('THEN should persist the password as a bcrypt hash, not plaintext', async () => {
        await authed(request(httpServer).post('/nurses'), adminToken).send({
          username: 'nurse02',
          password: 'Nurse@123',
          fullName: 'Điều dưỡng 02',
          role: UserRoleName.NURSE,
        });

        const stored = await dataSource
          .getRepository(User)
          .findOne({ where: { username: 'nurse02' } });

        expect(stored?.passwordHash).not.toBe('Nurse@123');
        await expect(bcrypt.compare('Nurse@123', stored?.passwordHash ?? '')).resolves.toBe(true);
      });
    });

    describe('GIVEN the username is already taken by a seeded user', () => {
      it('THEN should respond 409 Conflict', async () => {
        const response = await authed(request(httpServer).post('/nurses'), adminToken).send({
          username: 'nurse01',
          password: 'Nurse@123',
          fullName: 'Trùng Tên',
          role: UserRoleName.NURSE,
        });

        expect(response.status).toBe(409);
      });
    });

    describe('GIVEN the password does not meet the complexity policy', () => {
      it('THEN should respond 400 Bad Request', async () => {
        const response = await authed(request(httpServer).post('/nurses'), adminToken).send({
          username: 'weaknurse',
          password: 'weak',
          fullName: 'Yếu Mật Khẩu',
          role: UserRoleName.NURSE,
        });

        expect(response.status).toBe(400);
      });
    });

    describe('GIVEN the request is missing the required fullName field', () => {
      it('THEN should respond 400 Bad Request', async () => {
        const response = await authed(request(httpServer).post('/nurses'), adminToken).send({
          username: 'nofullname',
          password: 'Nurse@123',
          role: UserRoleName.NURSE,
        });

        expect(response.status).toBe(400);
      });
    });

    describe('GIVEN no Authorization header is present', () => {
      it('THEN should respond 401 Unauthorized', async () => {
        const response = await request(httpServer).post('/nurses').send({
          username: 'unauthed',
          password: 'Nurse@123',
          fullName: 'Không Xác Thực',
          role: UserRoleName.NURSE,
        });

        expect(response.status).toBe(401);
      });
    });
  });

  describe('PATCH /nurses/:id', () => {
    describe('GIVEN a seeded nurse id and new fullName/phoneNumber', () => {
      it('THEN should respond 200 with the updated fields', async () => {
        const response = await authed(request(httpServer).patch('/nurses/3'), adminToken).send({
          fullName: 'Điều dưỡng Cập Nhật',
          phoneNumber: '0909090909',
        });

        expect(response.status).toBe(200);
        expect(response.body as NurseResponseDto).toEqual(
          expect.objectContaining({
            id: 3,
            fullName: 'Điều dưỡng Cập Nhật',
            phoneNumber: '0909090909',
          }),
        );
      });

      it('THEN should persist the updated fullName', async () => {
        await authed(request(httpServer).patch('/nurses/3'), adminToken).send({
          fullName: 'Điều dưỡng Cập Nhật',
        });

        const stored = await dataSource.getRepository(User).findOne({ where: { id: 3 } });
        expect(stored?.fullName).toBe('Điều dưỡng Cập Nhật');
      });
    });

    describe('GIVEN a new password', () => {
      it('THEN should persist a new bcrypt hash that verifies the new password and rejects the old one', async () => {
        const before = await dataSource.getRepository(User).findOne({ where: { id: 3 } });

        await authed(request(httpServer).patch('/nurses/3'), adminToken).send({
          password: 'NewPass@99',
        });

        const after = await dataSource.getRepository(User).findOne({ where: { id: 3 } });
        expect(after?.passwordHash).not.toBe(before?.passwordHash);
        await expect(bcrypt.compare('NewPass@99', after?.passwordHash ?? '')).resolves.toBe(true);
        await expect(bcrypt.compare('Nurse@123', after?.passwordHash ?? '')).resolves.toBe(false);
      });
    });

    describe('GIVEN a new role', () => {
      it('THEN should respond 200 with the role replaced', async () => {
        const response = await authed(request(httpServer).patch('/nurses/3'), adminToken).send({
          role: UserRoleName.HEAD_NURSE,
        });

        expect(response.status).toBe(200);
        expect((response.body as NurseResponseDto).roles).toEqual(['Head_Nurse']);
      });
    });

    describe('GIVEN an id that belongs to a seeded user who is not a nurse', () => {
      it('THEN should respond 404 Not Found', async () => {
        const response = await authed(request(httpServer).patch('/nurses/4'), adminToken).send({
          fullName: 'Không Phải Điều Dưỡng',
        });

        expect(response.status).toBe(404);
      });
    });

    describe('GIVEN an id that does not exist', () => {
      it('THEN should respond 404 Not Found', async () => {
        const response = await authed(request(httpServer).patch('/nurses/999999'), adminToken).send(
          {
            fullName: 'Không Tồn Tại',
          },
        );

        expect(response.status).toBe(404);
      });
    });

    describe('GIVEN no Authorization header is present', () => {
      it('THEN should respond 401 Unauthorized', async () => {
        const response = await request(httpServer)
          .patch('/nurses/3')
          .send({ fullName: 'Không Xác Thực' });

        expect(response.status).toBe(401);
      });
    });
  });

  describe('DELETE /nurses/:id', () => {
    describe('GIVEN a seeded, active nurse id', () => {
      it('THEN should respond 200 with the nurse marked inactive', async () => {
        const response = await authed(request(httpServer).delete('/nurses/3'), adminToken);

        expect(response.status).toBe(200);
        expect((response.body as NurseResponseDto).isActive).toBe(false);
      });

      // Kept separate from the response-shape assertion above: this is verifying
      // persistence, a different system than "did the HTTP response look right."
      it('THEN should persist the deactivation as a soft delete, not a row removal', async () => {
        await authed(request(httpServer).delete('/nurses/3'), adminToken);

        const stored = await dataSource.getRepository(User).findOne({ where: { id: 3 } });
        expect(stored).not.toBeNull();
        expect(stored?.isActive).toBe(false);
      });
    });

    describe('GIVEN an id that belongs to a seeded user who is not a nurse', () => {
      it('THEN should respond 404 Not Found', async () => {
        const response = await authed(request(httpServer).delete('/nurses/4'), adminToken);

        expect(response.status).toBe(404);
      });
    });

    describe('GIVEN an id that does not exist', () => {
      it('THEN should respond 404 Not Found', async () => {
        const response = await authed(request(httpServer).delete('/nurses/999999'), adminToken);

        expect(response.status).toBe(404);
      });
    });

    describe('GIVEN no Authorization header is present', () => {
      it('THEN should respond 401 Unauthorized', async () => {
        const response = await request(httpServer).delete('/nurses/3');

        expect(response.status).toBe(401);
      });
    });
  });
});
