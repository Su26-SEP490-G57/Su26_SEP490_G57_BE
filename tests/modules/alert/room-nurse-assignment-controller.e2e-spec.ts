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
import { RoomNurseAssignment } from '../../../src/modules/alert/entities/room-nurse-assignment.entity';
import { UserRoleName } from '../../../src/modules/user/enums/user-role.enum';
import { authed, login } from '../../global/auth-helpers';
import {
  getTestDataSource,
  resetTestDataSource,
  closeTestDataSource,
} from '../../global/db-context';

// seed.ts assigns nurse01 (user id 3) to rooms P502 and P504
// (see src/database/seeds/seed.ts, "Room Nurse Assignments"), so those rows are
// used directly as fixtures below rather than re-deriving them per test.
describe('RoomNurseAssignmentController (integration)', () => {
  let app: INestApplication;
  let httpServer: Server;
  let dataSource: DataSource;
  let headNurseToken: string;
  let nurseToken: string;

  beforeAll(async () => {
    dataSource = await getTestDataSource();

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

    const headNurseLogin = await login(httpServer, UserRoleName.HEAD_NURSE);
    headNurseToken = (headNurseLogin.body as LoginResponse).accessToken;

    const nurseLogin = await login(httpServer, UserRoleName.NURSE);
    nurseToken = (nurseLogin.body as LoginResponse).accessToken;
  });

  afterAll(async () => {
    await app.close();
    await closeTestDataSource();
  });

  describe('GET /room-nurse-assignments/:roomCode', () => {
    describe('GIVEN the room has an assigned nurse', () => {
      it('THEN should respond 200 with that nurse id', async () => {
        const response = await authed(
          request(httpServer).get('/room-nurse-assignments/P502'),
          headNurseToken,
        );

        expect(response.status).toBe(200);
        expect(response.body as number[]).toEqual([3]);
      });
    });

    describe('GIVEN the room code has surrounding whitespace and lowercase letters', () => {
      it('THEN should normalize it before querying and still find the assignment', async () => {
        const response = await authed(
          request(httpServer).get('/room-nurse-assignments/%20p502%20'),
          headNurseToken,
        );

        expect(response.status).toBe(200);
        expect(response.body as number[]).toEqual([3]);
      });
    });

    describe('GIVEN the room has no assigned nurse', () => {
      it('THEN should respond 200 with an empty array', async () => {
        const response = await authed(
          request(httpServer).get('/room-nurse-assignments/P999'),
          headNurseToken,
        );

        expect(response.status).toBe(200);
        expect(response.body).toEqual([]);
      });
    });

    describe('GIVEN an Admin caller', () => {
      it('THEN should respond 200', async () => {
        const adminLogin = await login(httpServer, UserRoleName.ADMIN);
        const adminToken = (adminLogin.body as LoginResponse).accessToken;

        const response = await authed(
          request(httpServer).get('/room-nurse-assignments/P502'),
          adminToken,
        );

        expect(response.status).toBe(200);
      });
    });

    describe('GIVEN a Nurse caller (not Head Nurse/Admin)', () => {
      it('THEN should respond 403 Forbidden', async () => {
        const response = await authed(
          request(httpServer).get('/room-nurse-assignments/P502'),
          nurseToken,
        );

        expect(response.status).toBe(403);
      });
    });

    describe('GIVEN no Authorization header is present', () => {
      it('THEN should respond 401 Unauthorized', async () => {
        const response = await request(httpServer).get('/room-nurse-assignments/P502');

        expect(response.status).toBe(401);
      });
    });
  });

  describe('POST /room-nurse-assignments/bulk', () => {
    describe('GIVEN roomCodes and nurseIds as a Head Nurse caller', () => {
      // NestJS defaults @Post() handlers to 201 Created (no @HttpCode override
      // on this route), even though the response body is a plain confirmation
      // message rather than a created resource.
      it('THEN should respond 201 with a confirmation message', async () => {
        const response = await authed(
          request(httpServer).post('/room-nurse-assignments/bulk'),
          headNurseToken,
        ).send({ roomCodes: ['P999'], nurseIds: [2, 3] });

        expect(response.status).toBe(201);
        expect(response.body).toEqual({ message: 'Bulk assignments updated successfully' });
      });

      it('THEN should persist the cross-product of rooms and nurses, normalized to uppercase', async () => {
        await authed(request(httpServer).post('/room-nurse-assignments/bulk'), headNurseToken).send(
          { roomCodes: [' p999 '], nurseIds: [2, 3] },
        );

        const rows = await dataSource
          .getRepository(RoomNurseAssignment)
          .find({ where: { roomCode: 'P999' } });
        expect(rows.map((r) => r.nurseUserId).sort()).toEqual([2, 3]);
      });

      // Kept separate from the persistence assertion above: this is verifying
      // the delete-then-recreate replace semantics of bulkAssign, a different
      // behavior than "did the new rows get created."
      it('THEN should replace any existing assignments for the given room codes', async () => {
        // seed.ts already assigns nurse01 (id 3) to P502.
        await authed(request(httpServer).post('/room-nurse-assignments/bulk'), headNurseToken).send(
          { roomCodes: ['P502'], nurseIds: [2] },
        );

        const rows = await dataSource
          .getRepository(RoomNurseAssignment)
          .find({ where: { roomCode: 'P502' } });
        expect(rows.map((r) => r.nurseUserId)).toEqual([2]);
      });

      it('THEN should leave assignments for room codes not included in the request untouched', async () => {
        await authed(request(httpServer).post('/room-nurse-assignments/bulk'), headNurseToken).send(
          { roomCodes: ['P999'], nurseIds: [2] },
        );

        // seed.ts assigns nurse01 (id 3) to P504, which wasn't part of this request.
        const untouched = await dataSource
          .getRepository(RoomNurseAssignment)
          .find({ where: { roomCode: 'P504' } });
        expect(untouched.map((r) => r.nurseUserId)).toEqual([3]);
      });
    });

    describe('GIVEN a Nurse caller (not Head Nurse/Admin)', () => {
      it('THEN should respond 403 Forbidden', async () => {
        const response = await authed(
          request(httpServer).post('/room-nurse-assignments/bulk'),
          nurseToken,
        ).send({ roomCodes: ['P999'], nurseIds: [2] });

        expect(response.status).toBe(403);
      });
    });

    describe('GIVEN no Authorization header is present', () => {
      it('THEN should respond 401 Unauthorized', async () => {
        const response = await request(httpServer)
          .post('/room-nurse-assignments/bulk')
          .send({ roomCodes: ['P999'], nurseIds: [2] });

        expect(response.status).toBe(401);
      });
    });
  });
});
