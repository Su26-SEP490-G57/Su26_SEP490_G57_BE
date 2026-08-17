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
import { Patient } from '../../../src/modules/patient/entities/patient.entity';
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

// The actual runtime shape returned by NurseService.getAssignedRooms()/assignRooms() —
// NurseRoomAssignmentResponseDto (Swagger doc) additionally declares username/fullName,
// but the service never populates them, so we type against what the endpoints truly return.
interface NurseRoomAssignmentBody {
  nurseUserId: number;
  assignedRooms: string[];
}

// The actual runtime shape of GET /nurses/rooms — HospitalRoomSummaryDto (Swagger doc)
// additionally declares assignedNurses, but NurseRepository.getAllHospitalRooms() never
// populates it, so we type against what the endpoint truly returns.
interface HospitalRoomRow {
  roomCode: string;
  patientCount: number;
}

describe('NurseController (integration)', () => {
  let app: INestApplication;
  let httpServer: Server;
  let dataSource: DataSource;
  let adminToken: string;
  let nurseToken: string;
  let headNurseToken: string;

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

    const nurseLoginResponse = await login(httpServer, UserRoleName.NURSE);
    nurseToken = (nurseLoginResponse.body as LoginResponse).accessToken;

    const headNurseLoginResponse = await login(httpServer, UserRoleName.HEAD_NURSE);
    headNurseToken = (headNurseLoginResponse.body as LoginResponse).accessToken;
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

  describe('GET /nurses/rooms', () => {
    describe('GIVEN the ten seeded patient cases spread across three rooms, none ERAS-completed', () => {
      it('THEN should respond 200 with each room and its active patient count, ordered by room code', async () => {
        const response = await authed(request(httpServer).get('/nurses/rooms'), adminToken);

        expect(response.status).toBe(200);
        expect(response.body as HospitalRoomRow[]).toEqual([
          { roomCode: 'P502', patientCount: 4 },
          { roomCode: 'P504', patientCount: 2 },
          { roomCode: 'P506', patientCount: 4 },
        ]);
      });
    });

    describe('GIVEN one of the P502 patient cases has completed the ERAS protocol', () => {
      beforeEach(async () => {
        await dataSource
          .getRepository(Patient)
          .update({ caseId: 'CASE-001' }, { erasCompleted: true });
      });

      it('THEN should exclude that patient from the P502 active count', async () => {
        const response = await authed(request(httpServer).get('/nurses/rooms'), adminToken);

        expect(response.status).toBe(200);
        const p502 = (response.body as HospitalRoomRow[]).find((r) => r.roomCode === 'P502');
        expect(p502).toEqual({ roomCode: 'P502', patientCount: 3 });
      });
    });

    describe('GIVEN no Authorization header is present', () => {
      it('THEN should respond 401 Unauthorized', async () => {
        const response = await request(httpServer).get('/nurses/rooms');

        expect(response.status).toBe(401);
      });
    });
  });

  describe('GET /nurses/me/assigned-rooms', () => {
    describe('GIVEN the authenticated user has never had rooms assigned (seeded head_nurse account)', () => {
      it("THEN should respond 200 with the caller's own id and an empty room list", async () => {
        const response = await authed(
          request(httpServer).get('/nurses/me/assigned-rooms'),
          headNurseToken,
        );

        expect(response.status).toBe(200);
        // head_nurse is seeded with id 2 (tests/global/auth-helpers.ts) and carries no
        // default room_nurse_assignments rows (src/database/seeds/seed.ts only seeds nurse01/id 3).
        expect(response.body as NurseRoomAssignmentBody).toEqual({
          nurseUserId: 2,
          assignedRooms: [],
        });
      });
    });

    describe('GIVEN the caller is the seeded nurse account, which carries default room assignments', () => {
      it("THEN should respond 200 with the caller's own id and the seeded default rooms", async () => {
        const response = await authed(
          request(httpServer).get('/nurses/me/assigned-rooms'),
          nurseToken,
        );

        expect(response.status).toBe(200);
        // src/database/seeds/seed.ts seeds nurse01 (id 3) with P502, P504 by default.
        expect(response.body as NurseRoomAssignmentBody).toEqual({
          nurseUserId: 3,
          assignedRooms: ['P502', 'P504'],
        });
      });
    });

    describe('GIVEN the authenticated nurse has been reassigned to a different set of rooms', () => {
      beforeEach(async () => {
        await authed(request(httpServer).post('/nurses/3/assign-rooms'), adminToken).send({
          roomCodes: ['P506'],
        });
      });

      it("THEN should respond 200 with the caller's own new rooms, replacing the seeded default", async () => {
        const response = await authed(
          request(httpServer).get('/nurses/me/assigned-rooms'),
          nurseToken,
        );

        expect(response.status).toBe(200);
        expect(response.body as NurseRoomAssignmentBody).toEqual({
          nurseUserId: 3,
          assignedRooms: ['P506'],
        });
      });
    });

    describe('GIVEN no Authorization header is present', () => {
      it('THEN should respond 401 Unauthorized', async () => {
        const response = await request(httpServer).get('/nurses/me/assigned-rooms');

        expect(response.status).toBe(401);
      });
    });
  });

  describe('GET /nurses/:id/assigned-rooms', () => {
    describe('GIVEN a nurse with assigned rooms', () => {
      beforeEach(async () => {
        await authed(request(httpServer).post('/nurses/3/assign-rooms'), adminToken).send({
          roomCodes: ['P506', 'P502'],
        });
      });

      it('THEN should respond 200 with that nurse id and their assigned rooms', async () => {
        const response = await authed(
          request(httpServer).get('/nurses/3/assigned-rooms'),
          adminToken,
        );

        expect(response.status).toBe(200);
        expect(response.body as NurseRoomAssignmentBody).toEqual({
          nurseUserId: 3,
          assignedRooms: ['P502', 'P506'],
        });
      });
    });

    describe('GIVEN a seeded nurse with no room assignments', () => {
      it('THEN should respond 200 with an empty room list rather than 404', async () => {
        // head_nurse is seeded with id 2 and carries no default room_nurse_assignments rows
        // (src/database/seeds/seed.ts only seeds nurse01/id 3 with P502, P504).
        const response = await authed(
          request(httpServer).get('/nurses/2/assigned-rooms'),
          adminToken,
        );

        expect(response.status).toBe(200);
        expect(response.body as NurseRoomAssignmentBody).toEqual({
          nurseUserId: 2,
          assignedRooms: [],
        });
      });
    });

    describe('GIVEN an id that does not correspond to any user at all', () => {
      // Unlike GET /nurses/:id, getAssignedRooms() never verifies the id belongs to a
      // nurse (or to any user) — it just queries room_nurse_assignments directly.
      it('THEN should still respond 200 with an empty room list, not 404', async () => {
        const response = await authed(
          request(httpServer).get('/nurses/999999/assigned-rooms'),
          adminToken,
        );

        expect(response.status).toBe(200);
        expect(response.body as NurseRoomAssignmentBody).toEqual({
          nurseUserId: 999999,
          assignedRooms: [],
        });
      });
    });

    describe('GIVEN no Authorization header is present', () => {
      it('THEN should respond 401 Unauthorized', async () => {
        const response = await request(httpServer).get('/nurses/3/assigned-rooms');

        expect(response.status).toBe(401);
      });
    });
  });

  describe('POST /nurses/:id/assign-rooms', () => {
    describe('GIVEN a nurse with no prior room assignments and a list of room codes', () => {
      // head_nurse is seeded with id 2 and carries no default room_nurse_assignments rows
      // (src/database/seeds/seed.ts only seeds nurse01/id 3 with P502, P504).
      it('THEN should respond 201 with the assigned rooms', async () => {
        const response = await authed(
          request(httpServer).post('/nurses/2/assign-rooms'),
          adminToken,
        ).send({ roomCodes: ['P502', 'P503'] });

        expect(response.status).toBe(201);
        expect(response.body as NurseRoomAssignmentBody).toEqual({
          nurseUserId: 2,
          assignedRooms: ['P502', 'P503'],
        });
      });

      // Kept separate from the response-shape assertion above: this is verifying
      // persistence, a different system than "did the HTTP response look right."
      it('THEN should persist exactly those rooms for that nurse', async () => {
        await authed(request(httpServer).post('/nurses/2/assign-rooms'), adminToken).send({
          roomCodes: ['P502', 'P503'],
        });

        const rows = await dataSource.query<{ room_code: string }[]>(
          'SELECT room_code FROM room_nurse_assignments WHERE nurse_user_id = $1 ORDER BY room_code ASC',
          [2],
        );
        expect(rows.map((r) => r.room_code)).toEqual(['P502', 'P503']);
      });

      it('THEN should succeed for a caller authenticated as a nurse, not only admin', async () => {
        // The route carries no @Roles() metadata, so RolesGuard admits any authenticated user.
        const response = await authed(
          request(httpServer).post('/nurses/2/assign-rooms'),
          nurseToken,
        ).send({ roomCodes: ['P502'] });

        expect(response.status).toBe(201);
      });
    });

    describe('GIVEN room codes with duplicates and surrounding whitespace', () => {
      it('THEN should respond with a deduplicated, trimmed list', async () => {
        const response = await authed(
          request(httpServer).post('/nurses/3/assign-rooms'),
          adminToken,
        ).send({ roomCodes: [' P502 ', 'P502', 'P503', ' P503'] });

        expect(response.status).toBe(201);
        expect((response.body as NurseRoomAssignmentBody).assignedRooms).toEqual(['P502', 'P503']);
      });
    });

    describe('GIVEN the nurse already has a different set of assigned rooms', () => {
      beforeEach(async () => {
        await authed(request(httpServer).post('/nurses/3/assign-rooms'), adminToken).send({
          roomCodes: ['P506'],
        });
      });

      it('THEN a new assignment should replace the previous rooms rather than merge with them', async () => {
        const response = await authed(
          request(httpServer).post('/nurses/3/assign-rooms'),
          adminToken,
        ).send({ roomCodes: ['P502'] });

        expect(response.status).toBe(201);
        expect((response.body as NurseRoomAssignmentBody).assignedRooms).toEqual(['P502']);

        const rows = await dataSource.query<{ room_code: string }[]>(
          'SELECT room_code FROM room_nurse_assignments WHERE nurse_user_id = $1',
          [3],
        );
        expect(rows.map((r) => r.room_code)).toEqual(['P502']);
      });
    });

    describe('GIVEN an empty roomCodes array and a nurse with existing assignments', () => {
      beforeEach(async () => {
        await authed(request(httpServer).post('/nurses/3/assign-rooms'), adminToken).send({
          roomCodes: ['P502'],
        });
      });

      it('THEN should clear all room assignments for that nurse', async () => {
        const response = await authed(
          request(httpServer).post('/nurses/3/assign-rooms'),
          adminToken,
        ).send({ roomCodes: [] });

        expect(response.status).toBe(201);
        expect((response.body as NurseRoomAssignmentBody).assignedRooms).toEqual([]);
      });
    });

    describe('GIVEN a room is already assigned to a different nurse', () => {
      beforeEach(async () => {
        // head_nurse is seeded with id 2 (tests/global/auth-helpers.ts).
        await authed(request(httpServer).post('/nurses/2/assign-rooms'), adminToken).send({
          roomCodes: ['P502'],
        });
      });

      it('THEN assigning the same room to another nurse should succeed and leave both assigned (no exclusivity constraint)', async () => {
        const response = await authed(
          request(httpServer).post('/nurses/3/assign-rooms'),
          adminToken,
        ).send({ roomCodes: ['P502'] });

        expect(response.status).toBe(201);
        expect((response.body as NurseRoomAssignmentBody).assignedRooms).toEqual(['P502']);

        const headNurseRooms = await authed(
          request(httpServer).get('/nurses/2/assigned-rooms'),
          adminToken,
        );
        expect((headNurseRooms.body as NurseRoomAssignmentBody).assignedRooms).toEqual(['P502']);
      });
    });

    describe('GIVEN a request that reflects an assignment in GET /nurses/:id', () => {
      it("THEN the nurse's assignedRooms field should include the newly assigned rooms", async () => {
        await authed(request(httpServer).post('/nurses/3/assign-rooms'), adminToken).send({
          roomCodes: ['P502', 'P506'],
        });

        const response = await authed(request(httpServer).get('/nurses/3'), adminToken);

        expect(response.status).toBe(200);
        expect((response.body as NurseResponseDto).assignedRooms).toEqual(['P502', 'P506']);
      });
    });

    describe('GIVEN roomCodes contains a non-string element', () => {
      it('THEN should respond 400 Bad Request', async () => {
        const response = await authed(
          request(httpServer).post('/nurses/3/assign-rooms'),
          adminToken,
        ).send({ roomCodes: ['P502', 123] });

        expect(response.status).toBe(400);
      });
    });

    describe('GIVEN the roomCodes field is missing', () => {
      it('THEN should respond 400 Bad Request', async () => {
        const response = await authed(
          request(httpServer).post('/nurses/3/assign-rooms'),
          adminToken,
        ).send({});

        expect(response.status).toBe(400);
      });
    });

    describe('GIVEN the request body has an extra field not declared on the DTO', () => {
      it('THEN should respond 400 Bad Request', async () => {
        const response = await authed(
          request(httpServer).post('/nurses/3/assign-rooms'),
          adminToken,
        ).send({ roomCodes: ['P502'], extraField: 'unexpected' });

        expect(response.status).toBe(400);
      });
    });

    describe('GIVEN no Authorization header is present', () => {
      it('THEN should respond 401 Unauthorized', async () => {
        const response = await request(httpServer)
          .post('/nurses/3/assign-rooms')
          .send({ roomCodes: ['P502'] });

        expect(response.status).toBe(401);
      });
    });
  });

  describe('DELETE /nurses/:id/rooms/:roomCode', () => {
    describe('GIVEN the nurse currently has that room assigned, among others', () => {
      beforeEach(async () => {
        await authed(request(httpServer).post('/nurses/3/assign-rooms'), adminToken).send({
          roomCodes: ['P502', 'P504'],
        });
      });

      it('THEN should respond 200 and remove only that room, leaving the rest', async () => {
        const response = await authed(
          request(httpServer).delete('/nurses/3/rooms/P502'),
          adminToken,
        );

        expect(response.status).toBe(200);

        const after = await authed(request(httpServer).get('/nurses/3/assigned-rooms'), adminToken);
        expect((after.body as NurseRoomAssignmentBody).assignedRooms).toEqual(['P504']);
      });
    });

    describe('GIVEN the room is not currently assigned to that nurse', () => {
      it('THEN should still respond 200 as a no-op', async () => {
        const response = await authed(
          request(httpServer).delete('/nurses/3/rooms/P999'),
          adminToken,
        );

        expect(response.status).toBe(200);
      });
    });

    describe('GIVEN no Authorization header is present', () => {
      it('THEN should respond 401 Unauthorized', async () => {
        const response = await request(httpServer).delete('/nurses/3/rooms/P502');

        expect(response.status).toBe(401);
      });
    });
  });
});
