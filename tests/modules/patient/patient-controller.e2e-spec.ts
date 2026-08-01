import 'dotenv/config';
import type { Server } from 'http';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { getDataSourceToken } from '@nestjs/typeorm';
import { createMock, DeepMocked } from '@golevelup/ts-jest';
import * as bcrypt from 'bcrypt';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../../../src/app.module';
import { TimezoneInterceptor } from '../../../src/common/interceptors/timezone.interceptor';
import { LoginResponse } from '../../../src/modules/auth/services/auth.service';
import { PodLockResponseDto } from '../../../src/modules/patient/dtos/pod-lock.dto';
import { Patient } from '../../../src/modules/patient/entities/patient.entity';
import { PatientGateway } from '../../../src/modules/patient/gateways/patient.gateway';
import {
  CurrentPodResponse,
  PaginatedPatients,
  PatientOperationType,
  PatientWithAccount,
} from '../../../src/modules/patient/services/patient.service';
import { PaginatedAssessmentHistoryDto } from '../../../src/modules/symptom-survey/dtos/symptom-survey-response.dto';
import { User } from '../../../src/modules/user/entities/user.entity';
import { UserRoleName } from '../../../src/modules/user/enums/user-role.enum';
import { authed, login } from '../../global/auth-helpers';
import {
  getTestDataSource,
  resetTestDataSource,
  closeTestDataSource,
} from '../../global/db-context';

interface StartErasResponse {
  caseId: string;
  currentPod: number;
  podStartDate: string;
}

interface DeletePatientResponse {
  userId: number;
  caseId: string | null;
  deleted: true;
}

describe('PatientController (integration)', () => {
  let app: INestApplication;
  let httpServer: Server;
  let dataSource: DataSource;
  let patientGateway: DeepMocked<PatientGateway>;
  let nurseToken: string;
  let headNurseToken: string;
  let patientToken: string;

  beforeAll(async () => {
    dataSource = await getTestDataSource();
    patientGateway = createMock<PatientGateway>();

    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(getDataSourceToken())
      .useValue(dataSource)
      .overrideProvider(PatientGateway)
      .useValue(patientGateway)
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
    patientGateway.emitPodLocked.mockClear();
    patientGateway.emitPodUnlocked.mockClear();

    nurseToken = ((await login(httpServer, UserRoleName.NURSE)).body as LoginResponse).accessToken;
    headNurseToken = ((await login(httpServer, UserRoleName.HEAD_NURSE)).body as LoginResponse)
      .accessToken;
    patientToken = ((await login(httpServer, UserRoleName.PATIENT)).body as LoginResponse)
      .accessToken;
  });

  afterAll(async () => {
    await app.close();
    await closeTestDataSource();
  });

  describe('GET /patients', () => {
    describe('GIVEN no filters', () => {
      it('THEN should respond 200 with all 10 seeded active patients ordered Red→Yellow→Green then by case id', async () => {
        const response = await authed(request(httpServer).get('/patients'), nurseToken);

        expect(response.status).toBe(200);
        const body = response.body as PaginatedPatients;
        expect(body.total).toBe(10);
        expect(body.page).toBe(1);
        expect(body.limit).toBe(10);
        expect(body.data.map((p) => p.caseId)).toEqual([
          'CASE-003',
          'CASE-006',
          'CASE-009',
          'CASE-001',
          'CASE-005',
          'CASE-008',
          'CASE-002',
          'CASE-004',
          'CASE-007',
          'CASE-010',
        ]);
      });

      it('THEN should respond with each patient carrying its level and linked account', async () => {
        const response = await authed(request(httpServer).get('/patients'), nurseToken);

        const body = response.body as PaginatedPatients;
        const caseOne = body.data.find((p) => p.caseId === 'CASE-001');
        expect(caseOne?.currentPod).toBe(2);
        expect(caseOne?.level?.name).toBe('Yellow');
        expect(caseOne?.account?.username).toBe('patient01');
        expect(caseOne?.account?.fullName).toBe('Nguyễn Văn An');
      });
    });

    describe('GIVEN a search filter matching a case id', () => {
      it('THEN should respond 200 with only that case', async () => {
        const response = await authed(
          request(httpServer).get('/patients').query({ search: 'CASE-002' }),
          nurseToken,
        );

        expect(response.status).toBe(200);
        const body = response.body as PaginatedPatients;
        expect(body.total).toBe(1);
        expect(body.data[0].caseId).toBe('CASE-002');
      });
    });

    describe('GIVEN a search filter matching a patient full name', () => {
      it('THEN should respond 200 with only that patient', async () => {
        const response = await authed(
          request(httpServer).get('/patients').query({ search: 'Văn Cường' }),
          nurseToken,
        );

        expect(response.status).toBe(200);
        const body = response.body as PaginatedPatients;
        expect(body.total).toBe(1);
        expect(body.data[0].caseId).toBe('CASE-003');
      });
    });

    describe('GIVEN a level filter', () => {
      it('THEN should respond 200 with only patients at that level', async () => {
        const response = await authed(
          request(httpServer).get('/patients').query({ level: 'Red' }),
          nurseToken,
        );

        expect(response.status).toBe(200);
        const body = response.body as PaginatedPatients;
        expect(body.total).toBe(3);
        expect(body.data.map((p) => p.caseId)).toEqual(['CASE-003', 'CASE-006', 'CASE-009']);
      });
    });

    describe('GIVEN an operationTypeId filter', () => {
      it('THEN should respond 200 with only patients of that operation type', async () => {
        const response = await authed(
          request(httpServer).get('/patients').query({ operationTypeId: 1 }),
          nurseToken,
        );

        expect(response.status).toBe(200);
        const body = response.body as PaginatedPatients;
        expect(body.total).toBe(5);
        expect(body.data.every((p) => p.operationType?.id === 1)).toBe(true);
      });
    });

    describe('GIVEN sortBy=pod', () => {
      it('THEN should respond 200 with patients ordered by currentPod ascending', async () => {
        const response = await authed(
          request(httpServer).get('/patients').query({ sortBy: 'pod' }),
          nurseToken,
        );

        expect(response.status).toBe(200);
        const body = response.body as PaginatedPatients;
        const pods = body.data.map((p) => p.currentPod);
        expect(pods[0]).toBe(0);
        expect(pods[pods.length - 1]).toBe(5);
        for (let i = 1; i < pods.length; i++) {
          expect(pods[i]! >= pods[i - 1]!).toBe(true);
        }
      });
    });

    describe('GIVEN a pagination limit smaller than the total patient count', () => {
      it('THEN should respond 200 with a page of that size and the correct total', async () => {
        const response = await authed(
          request(httpServer).get('/patients').query({ page: 1, limit: 3 }),
          nurseToken,
        );

        expect(response.status).toBe(200);
        const body = response.body as PaginatedPatients;
        expect(body.data).toHaveLength(3);
        expect(body.total).toBe(10);
      });
    });

    describe('GIVEN one seeded patient has completed the ERAS protocol', () => {
      beforeEach(async () => {
        await dataSource
          .getRepository(Patient)
          .update({ caseId: 'CASE-005' }, { erasCompleted: true });
      });

      it('THEN should respond 200 excluding the completed patient from the list and total', async () => {
        const response = await authed(request(httpServer).get('/patients'), nurseToken);

        expect(response.status).toBe(200);
        const body = response.body as PaginatedPatients;
        expect(body.total).toBe(9);
        expect(body.data.some((p) => p.caseId === 'CASE-005')).toBe(false);
      });
    });

    describe('GIVEN an unrecognized level value', () => {
      it('THEN should respond 400 Bad Request', async () => {
        const response = await authed(
          request(httpServer).get('/patients').query({ level: 'Blue' }),
          nurseToken,
        );

        expect(response.status).toBe(400);
      });
    });

    describe('GIVEN no Authorization header is present', () => {
      it('THEN should respond 401 Unauthorized', async () => {
        const response = await request(httpServer).get('/patients');

        expect(response.status).toBe(401);
      });
    });
  });

  describe('GET /patients/operation-types', () => {
    describe('GIVEN an authenticated caller', () => {
      it('THEN should respond 200 with both seeded operation types', async () => {
        const response = await authed(
          request(httpServer).get('/patients/operation-types'),
          nurseToken,
        );

        expect(response.status).toBe(200);
        const body = response.body as PatientOperationType[];
        expect(body).toHaveLength(2);
        expect(body).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ id: 1, name: 'Phẫu thuật dạ dày' }),
            expect.objectContaining({ id: 2, name: 'Phẫu thuật đại trực tràng' }),
          ]),
        );
      });
    });

    describe('GIVEN no Authorization header is present', () => {
      it('THEN should respond 401 Unauthorized', async () => {
        const response = await request(httpServer).get('/patients/operation-types');

        expect(response.status).toBe(401);
      });
    });
  });

  describe('POST /patients', () => {
    describe('GIVEN a new unique caseId and required fields only', () => {
      it('THEN should respond 201 with the case created and a default-provisioned account', async () => {
        const response = await authed(request(httpServer).post('/patients'), nurseToken).send({
          caseId: 'CASE-011',
          fullName: 'Người Bệnh Mới',
        });

        expect(response.status).toBe(201);
        const body = response.body as PatientWithAccount;
        expect(body.caseId).toBe('CASE-011');
        expect(body.currentPod).toBe(0);
        expect(body.level).toBeNull();
        expect(body.operationType).toBeNull();
        expect(body.account?.username).toBe('CASE-011');
        expect(body.account?.fullName).toBe('Người Bệnh Mới');
        expect(body.account?.isActive).toBe(true);
        expect(body.account?.roles).toEqual(['Patient']);
      });

      // Kept separate from the response-shape assertion above: this is verifying
      // persistence of the default credentials, a different system than "did the
      // HTTP response look right."
      it('THEN should persist the default password hashed with bcrypt', async () => {
        await authed(request(httpServer).post('/patients'), nurseToken).send({
          caseId: 'CASE-011',
          fullName: 'Người Bệnh Mới',
        });

        const stored = await dataSource
          .getRepository(User)
          .findOne({ where: { username: 'CASE-011' } });
        expect(stored).not.toBeNull();
        await expect(bcrypt.compare('Patient@123', stored?.passwordHash ?? '')).resolves.toBe(true);
      });
    });

    describe('GIVEN the caseId already belongs to a seeded patient', () => {
      it('THEN should respond 409 Conflict', async () => {
        const response = await authed(request(httpServer).post('/patients'), nurseToken).send({
          caseId: 'CASE-001',
          fullName: 'Trùng Mã Ca',
        });

        expect(response.status).toBe(409);
      });
    });

    describe('GIVEN the username is already taken by a seeded account', () => {
      it('THEN should respond 409 Conflict', async () => {
        const response = await authed(request(httpServer).post('/patients'), nurseToken).send({
          caseId: 'CASE-011',
          fullName: 'Người Bệnh Mới',
          username: 'nurse01',
        });

        expect(response.status).toBe(409);
      });
    });

    describe('GIVEN an operationTypeId that does not exist', () => {
      it('THEN should respond 400 Bad Request', async () => {
        const response = await authed(request(httpServer).post('/patients'), nurseToken).send({
          caseId: 'CASE-011',
          fullName: 'Người Bệnh Mới',
          operationTypeId: 999,
        });

        expect(response.status).toBe(400);
      });
    });

    describe('GIVEN an assignedNurseId that does not exist', () => {
      it('THEN should respond 400 Bad Request', async () => {
        const response = await authed(request(httpServer).post('/patients'), nurseToken).send({
          caseId: 'CASE-011',
          fullName: 'Người Bệnh Mới',
          assignedNurseId: 999999,
        });

        expect(response.status).toBe(400);
      });
    });

    describe('GIVEN a password that does not meet the complexity policy', () => {
      it('THEN should respond 400 Bad Request', async () => {
        const response = await authed(request(httpServer).post('/patients'), nurseToken).send({
          caseId: 'CASE-011',
          fullName: 'Người Bệnh Mới',
          password: 'weak',
        });

        expect(response.status).toBe(400);
      });
    });

    describe('GIVEN the request is missing the required fullName field', () => {
      it('THEN should respond 400 Bad Request', async () => {
        const response = await authed(request(httpServer).post('/patients'), nurseToken).send({
          caseId: 'CASE-011',
        });

        expect(response.status).toBe(400);
      });
    });

    describe('GIVEN no Authorization header is present', () => {
      it('THEN should respond 401 Unauthorized', async () => {
        const response = await request(httpServer).post('/patients').send({
          caseId: 'CASE-011',
          fullName: 'Người Bệnh Mới',
        });

        expect(response.status).toBe(401);
      });
    });
  });

  describe('GET /patients/:id/current-pod', () => {
    describe('GIVEN a seeded case id', () => {
      it("THEN should respond 200 with that case's current POD and lock state", async () => {
        const response = await authed(
          request(httpServer).get('/patients/CASE-001/current-pod'),
          nurseToken,
        );

        expect(response.status).toBe(200);
        expect(response.body as CurrentPodResponse).toEqual({
          caseId: 'CASE-001',
          currentPod: 2,
          isLocked: false,
          holdReason: null,
        });
      });
    });

    describe('GIVEN a case id that does not exist', () => {
      it('THEN should respond 404 Not Found', async () => {
        const response = await authed(
          request(httpServer).get('/patients/CASE-999/current-pod'),
          nurseToken,
        );

        expect(response.status).toBe(404);
      });
    });

    describe('GIVEN no Authorization header is present', () => {
      it('THEN should respond 401 Unauthorized', async () => {
        const response = await request(httpServer).get('/patients/CASE-001/current-pod');

        expect(response.status).toBe(401);
      });
    });
  });

  describe('GET /patients/:id/assessments', () => {
    describe('GIVEN a Nurse caller and a case id with a seeded assessment', () => {
      it('THEN should respond 200 with that assessment in the history', async () => {
        const response = await authed(
          request(httpServer).get('/patients/CASE-001/assessments'),
          nurseToken,
        );

        expect(response.status).toBe(200);
        const body = response.body as PaginatedAssessmentHistoryDto;
        expect(body.total).toBe(1);
        expect(body.data[0]).toEqual(
          expect.objectContaining({ triageColor: 'Yellow', podContext: 2 }),
        );
      });
    });

    describe('GIVEN a case id with no seeded assessments', () => {
      it('THEN should respond 200 with an empty history', async () => {
        const response = await authed(
          request(httpServer).get('/patients/CASE-999/assessments'),
          nurseToken,
        );

        expect(response.status).toBe(200);
        const body = response.body as PaginatedAssessmentHistoryDto;
        expect(body.total).toBe(0);
        expect(body.data).toEqual([]);
      });
    });

    describe('GIVEN a Patient caller (not Nurse/Head Nurse)', () => {
      it('THEN should respond 403 Forbidden', async () => {
        const response = await authed(
          request(httpServer).get('/patients/CASE-001/assessments'),
          patientToken,
        );

        expect(response.status).toBe(403);
      });
    });

    describe('GIVEN no Authorization header is present', () => {
      it('THEN should respond 401 Unauthorized', async () => {
        const response = await request(httpServer).get('/patients/CASE-001/assessments');

        expect(response.status).toBe(401);
      });
    });
  });

  describe('POST /patients/:id/start-eras', () => {
    describe('GIVEN a Head Nurse caller and a patient that has not started ERAS', () => {
      beforeEach(async () => {
        await authed(request(httpServer).post('/patients'), nurseToken).send({
          caseId: 'CASE-NEW',
          fullName: 'Bệnh Nhân Chưa Bắt Đầu',
        });
      });

      it('THEN should respond 201 with POD reset to 0 and a start date recorded', async () => {
        const response = await authed(
          request(httpServer).post('/patients/CASE-NEW/start-eras'),
          headNurseToken,
        );

        expect(response.status).toBe(201);
        const body = response.body as StartErasResponse;
        expect(body.caseId).toBe('CASE-NEW');
        expect(body.currentPod).toBe(0);
        expect(new Date(body.podStartDate).toString()).not.toBe('Invalid Date');
      });

      // Kept separate from the response-shape assertion above: this is verifying
      // persistence, a different system than "did the HTTP response look right."
      it('THEN should persist the pod start date and unlock the case', async () => {
        await authed(request(httpServer).post('/patients/CASE-NEW/start-eras'), headNurseToken);

        const stored = await dataSource
          .getRepository(Patient)
          .findOne({ where: { caseId: 'CASE-NEW' } });
        expect(stored?.podStartDate).not.toBeNull();
        expect(stored?.currentPod).toBe(0);
        expect(stored?.isLocked).toBe(false);
      });
    });

    describe('GIVEN a case that has already started ERAS', () => {
      it('THEN should respond 400 Bad Request', async () => {
        const response = await authed(
          request(httpServer).post('/patients/CASE-001/start-eras'),
          headNurseToken,
        );

        expect(response.status).toBe(400);
      });
    });

    describe('GIVEN a case id that does not exist', () => {
      it('THEN should respond 404 Not Found', async () => {
        const response = await authed(
          request(httpServer).post('/patients/CASE-999/start-eras'),
          headNurseToken,
        );

        expect(response.status).toBe(404);
      });
    });

    describe('GIVEN a Nurse caller (not Head Nurse)', () => {
      it('THEN should respond 403 Forbidden', async () => {
        const response = await authed(
          request(httpServer).post('/patients/CASE-001/start-eras'),
          nurseToken,
        );

        expect(response.status).toBe(403);
      });
    });

    describe('GIVEN no Authorization header is present', () => {
      it('THEN should respond 401 Unauthorized', async () => {
        const response = await request(httpServer).post('/patients/CASE-001/start-eras');

        expect(response.status).toBe(401);
      });
    });
  });

  describe('PATCH /patients/:id/pod-lock', () => {
    describe('GIVEN isLocked=true with a holdReason on an active case', () => {
      it('THEN should respond 200 with the case locked and the reason attached', async () => {
        const response = await authed(
          request(httpServer).patch('/patients/CASE-001/pod-lock'),
          nurseToken,
        ).send({ isLocked: true, holdReason: 'Bệnh nhân nôn nhiều' });

        expect(response.status).toBe(200);
        expect(response.body as PodLockResponseDto).toEqual({
          caseId: 'CASE-001',
          currentPod: 2,
          isLocked: true,
          holdReason: 'Bệnh nhân nôn nhiều',
        });
      });

      // Kept separate from the response-shape assertion above: this is verifying
      // persistence, a different system than "did the HTTP response look right."
      it('THEN should persist the lock state, reason, and lockedAt timestamp', async () => {
        await authed(request(httpServer).patch('/patients/CASE-001/pod-lock'), nurseToken).send({
          isLocked: true,
          holdReason: 'Bệnh nhân nôn nhiều',
        });

        const stored = await dataSource
          .getRepository(Patient)
          .findOne({ where: { caseId: 'CASE-001' } });
        expect(stored?.isLocked).toBe(true);
        expect(stored?.reasonHoldPod).toBe('Bệnh nhân nôn nhiều');
        expect(stored?.lockedAt).not.toBeNull();
      });

      // Kept separate: emitting over the gateway is an independent side effect
      // from persistence, not part of the same returned/stored object.
      it('THEN should emit pod.locked over the patient gateway', async () => {
        await authed(request(httpServer).patch('/patients/CASE-001/pod-lock'), nurseToken).send({
          isLocked: true,
          holdReason: 'Bệnh nhân nôn nhiều',
        });

        expect(patientGateway.emitPodLocked).toHaveBeenCalledTimes(1);
        expect(patientGateway.emitPodLocked).toHaveBeenCalledWith(
          expect.objectContaining({ caseId: 'CASE-001', isLocked: true }),
        );
        expect(patientGateway.emitPodUnlocked).not.toHaveBeenCalled();
      });
    });

    describe('GIVEN isLocked=true without a holdReason', () => {
      it('THEN should respond 400 Bad Request', async () => {
        const response = await authed(
          request(httpServer).patch('/patients/CASE-001/pod-lock'),
          nurseToken,
        ).send({ isLocked: true });

        expect(response.status).toBe(400);
      });
    });

    describe('GIVEN a case that is currently locked', () => {
      let lockedAt: Date;

      beforeEach(async () => {
        lockedAt = new Date(Date.now() - 60 * 60 * 1000);
        await dataSource.getRepository(Patient).update(
          { caseId: 'CASE-001' },
          {
            isLocked: true,
            reasonHoldPod: 'Đang theo dõi',
            lockedAt,
          },
        );
      });

      it('THEN unlocking should respond 200 with the case unlocked and the reason cleared', async () => {
        const response = await authed(
          request(httpServer).patch('/patients/CASE-001/pod-lock'),
          nurseToken,
        ).send({ isLocked: false });

        expect(response.status).toBe(200);
        expect(response.body as PodLockResponseDto).toEqual({
          caseId: 'CASE-001',
          currentPod: 2,
          isLocked: false,
          holdReason: null,
        });
      });

      // Kept separate: shifting the pod start date forward by the lock duration
      // is a distinct persisted effect from the response/lock-state itself.
      it('THEN unlocking should shift podStartDate forward by roughly the lock duration', async () => {
        const before = await dataSource
          .getRepository(Patient)
          .findOne({ where: { caseId: 'CASE-001' } });
        const originalStart = new Date(before!.podStartDate!).getTime();

        await authed(request(httpServer).patch('/patients/CASE-001/pod-lock'), nurseToken).send({
          isLocked: false,
        });

        const after = await dataSource
          .getRepository(Patient)
          .findOne({ where: { caseId: 'CASE-001' } });
        expect(after?.isLocked).toBe(false);
        expect(after?.lockedAt).toBeNull();
        const shiftMs = new Date(after!.podStartDate!).getTime() - originalStart;
        const expectedShiftMs = Date.now() - lockedAt.getTime();
        expect(Math.abs(shiftMs - expectedShiftMs)).toBeLessThan(5000);
      });

      it('THEN unlocking should emit pod.unlocked over the patient gateway', async () => {
        await authed(request(httpServer).patch('/patients/CASE-001/pod-lock'), nurseToken).send({
          isLocked: false,
        });

        expect(patientGateway.emitPodUnlocked).toHaveBeenCalledTimes(1);
        expect(patientGateway.emitPodUnlocked).toHaveBeenCalledWith(
          expect.objectContaining({ caseId: 'CASE-001', isLocked: false }),
        );
        expect(patientGateway.emitPodLocked).not.toHaveBeenCalled();
      });
    });

    describe('GIVEN a case with no active POD', () => {
      beforeEach(async () => {
        await dataSource
          .getRepository(Patient)
          .update({ caseId: 'CASE-001' }, { currentPod: null });
      });

      it('THEN should respond 400 Bad Request', async () => {
        const response = await authed(
          request(httpServer).patch('/patients/CASE-001/pod-lock'),
          nurseToken,
        ).send({ isLocked: true, holdReason: 'Bất kỳ' });

        expect(response.status).toBe(400);
      });
    });

    describe('GIVEN a case id that does not exist', () => {
      it('THEN should respond 404 Not Found', async () => {
        const response = await authed(
          request(httpServer).patch('/patients/CASE-999/pod-lock'),
          nurseToken,
        ).send({ isLocked: true, holdReason: 'Bất kỳ' });

        expect(response.status).toBe(404);
      });
    });

    describe('GIVEN a Patient caller (not Nurse/Head Nurse)', () => {
      it('THEN should respond 403 Forbidden', async () => {
        const response = await authed(
          request(httpServer).patch('/patients/CASE-001/pod-lock'),
          patientToken,
        ).send({ isLocked: true, holdReason: 'Bất kỳ' });

        expect(response.status).toBe(403);
      });
    });

    describe('GIVEN no Authorization header is present', () => {
      it('THEN should respond 401 Unauthorized', async () => {
        const response = await request(httpServer)
          .patch('/patients/CASE-001/pod-lock')
          .send({ isLocked: true, holdReason: 'Bất kỳ' });

        expect(response.status).toBe(401);
      });
    });
  });

  describe('PATCH /patients/:id/pod-level', () => {
    describe('GIVEN a valid rollback level below the current POD', () => {
      it('THEN should respond 200 with the POD level rolled back', async () => {
        const response = await authed(
          request(httpServer).patch('/patients/CASE-001/pod-level'),
          nurseToken,
        ).send({ podLevel: 1 });

        expect(response.status).toBe(200);
        expect((response.body as PatientWithAccount).currentPod).toBe(1);
      });

      // Kept separate from the response-shape assertion above: this is verifying
      // persistence, a different system than "did the HTTP response look right."
      it('THEN should persist the rolled-back POD level', async () => {
        await authed(request(httpServer).patch('/patients/CASE-001/pod-level'), nurseToken).send({
          podLevel: 1,
        });

        const stored = await dataSource
          .getRepository(Patient)
          .findOne({ where: { caseId: 'CASE-001' } });
        expect(stored?.currentPod).toBe(1);
      });
    });

    describe('GIVEN the patient had completed ERAS at the max POD for their operation type', () => {
      beforeEach(async () => {
        // Operation type 1 (Phẫu thuật dạ dày) has 6 seeded POD protocols (POD0–POD5),
        // so its max POD is 5.
        await dataSource
          .getRepository(Patient)
          .update({ caseId: 'CASE-002' }, { currentPod: 5, erasCompleted: true });
      });

      it('THEN rolling back below the max POD should reset erasCompleted to false', async () => {
        const response = await authed(
          request(httpServer).patch('/patients/CASE-002/pod-level'),
          nurseToken,
        ).send({ podLevel: 3 });

        expect(response.status).toBe(200);
        expect((response.body as PatientWithAccount).erasCompleted).toBe(false);

        const stored = await dataSource
          .getRepository(Patient)
          .findOne({ where: { caseId: 'CASE-002' } });
        expect(stored?.erasCompleted).toBe(false);
      });
    });

    describe('GIVEN a podLevel equal to the current POD', () => {
      it('THEN should respond 400 Bad Request', async () => {
        const response = await authed(
          request(httpServer).patch('/patients/CASE-001/pod-level'),
          nurseToken,
        ).send({ podLevel: 2 });

        expect(response.status).toBe(400);
      });
    });

    describe('GIVEN a negative podLevel', () => {
      it('THEN should respond 400 Bad Request', async () => {
        const response = await authed(
          request(httpServer).patch('/patients/CASE-001/pod-level'),
          nurseToken,
        ).send({ podLevel: -1 });

        expect(response.status).toBe(400);
      });
    });

    describe('GIVEN a case with no active POD', () => {
      beforeEach(async () => {
        await dataSource
          .getRepository(Patient)
          .update({ caseId: 'CASE-001' }, { currentPod: null });
      });

      it('THEN should respond 400 Bad Request', async () => {
        const response = await authed(
          request(httpServer).patch('/patients/CASE-001/pod-level'),
          nurseToken,
        ).send({ podLevel: 0 });

        expect(response.status).toBe(400);
      });
    });

    describe('GIVEN a case id that does not exist', () => {
      it('THEN should respond 404 Not Found', async () => {
        const response = await authed(
          request(httpServer).patch('/patients/CASE-999/pod-level'),
          nurseToken,
        ).send({ podLevel: 0 });

        expect(response.status).toBe(404);
      });
    });

    describe('GIVEN a Patient caller (not Nurse/Head Nurse)', () => {
      it('THEN should respond 403 Forbidden', async () => {
        const response = await authed(
          request(httpServer).patch('/patients/CASE-001/pod-level'),
          patientToken,
        ).send({ podLevel: 0 });

        expect(response.status).toBe(403);
      });
    });

    describe('GIVEN no Authorization header is present', () => {
      it('THEN should respond 401 Unauthorized', async () => {
        const response = await request(httpServer)
          .patch('/patients/CASE-001/pod-level')
          .send({ podLevel: 0 });

        expect(response.status).toBe(401);
      });
    });
  });

  describe('PATCH /patients/:id', () => {
    describe('GIVEN the account user id of a seeded patient and new fullName/phoneNumber', () => {
      it('THEN should respond 200 with the updated fields', async () => {
        const response = await authed(request(httpServer).patch('/patients/4'), nurseToken).send({
          fullName: 'Nguyễn Văn An Cập Nhật',
          phoneNumber: '0911111111',
        });

        expect(response.status).toBe(200);
        const body = response.body as PatientWithAccount;
        expect(body.caseId).toBe('CASE-001');
        expect(body.account?.fullName).toBe('Nguyễn Văn An Cập Nhật');
        expect(body.account?.phoneNumber).toBe('0911111111');
      });

      // Kept separate from the response-shape assertion above: this is verifying
      // persistence, a different system than "did the HTTP response look right."
      it('THEN should persist the updated fullName on the linked account', async () => {
        await authed(request(httpServer).patch('/patients/4'), nurseToken).send({
          fullName: 'Nguyễn Văn An Cập Nhật',
        });

        const stored = await dataSource.getRepository(User).findOne({ where: { id: 4 } });
        expect(stored?.fullName).toBe('Nguyễn Văn An Cập Nhật');
      });
    });

    describe('GIVEN the new username is already taken by another seeded account', () => {
      it('THEN should respond 409 Conflict', async () => {
        const response = await authed(request(httpServer).patch('/patients/4'), nurseToken).send({
          username: 'nurse01',
        });

        expect(response.status).toBe(409);
      });
    });

    describe('GIVEN an operationTypeId that does not exist', () => {
      it('THEN should respond 400 Bad Request', async () => {
        const response = await authed(request(httpServer).patch('/patients/4'), nurseToken).send({
          operationTypeId: 999,
        });

        expect(response.status).toBe(400);
      });
    });

    describe('GIVEN the account user id belongs to a non-patient user (no linked case)', () => {
      it('THEN should respond 404 Not Found', async () => {
        const response = await authed(request(httpServer).patch('/patients/1'), nurseToken).send({
          fullName: 'Không Phải Bệnh Nhân',
        });

        expect(response.status).toBe(404);
      });
    });

    describe('GIVEN a user id that does not exist', () => {
      it('THEN should respond 404 Not Found', async () => {
        const response = await authed(
          request(httpServer).patch('/patients/999999'),
          nurseToken,
        ).send({ fullName: 'Không Tồn Tại' });

        expect(response.status).toBe(404);
      });
    });

    describe('GIVEN no Authorization header is present', () => {
      it('THEN should respond 401 Unauthorized', async () => {
        const response = await request(httpServer)
          .patch('/patients/4')
          .send({ fullName: 'Không Xác Thực' });

        expect(response.status).toBe(401);
      });
    });
  });

  describe('DELETE /patients/:id', () => {
    describe('GIVEN the account user id of a seeded patient', () => {
      it('THEN should respond 200 with the user id, case id, and deleted flag', async () => {
        const response = await authed(request(httpServer).delete('/patients/4'), nurseToken);

        expect(response.status).toBe(200);
        expect(response.body as DeletePatientResponse).toEqual({
          userId: 4,
          caseId: 'CASE-001',
          deleted: true,
        });
      });

      // Kept separate from the response-shape assertion above: this is verifying
      // persistence, a different system than "did the HTTP response look right."
      it('THEN should soft-delete both the account and its linked patient case', async () => {
        await authed(request(httpServer).delete('/patients/4'), nurseToken);

        const storedUser = await dataSource
          .getRepository(User)
          .findOne({ where: { id: 4 }, withDeleted: true });
        const storedPatient = await dataSource
          .getRepository(Patient)
          .findOne({ where: { caseId: 'CASE-001' }, withDeleted: true });
        expect(storedUser?.deletedAt).not.toBeNull();
        expect(storedPatient?.deletedAt).not.toBeNull();
      });
    });

    describe('GIVEN a user id that does not exist', () => {
      it('THEN should respond 404 Not Found', async () => {
        const response = await authed(request(httpServer).delete('/patients/999999'), nurseToken);

        expect(response.status).toBe(404);
      });
    });

    describe('GIVEN no Authorization header is present', () => {
      it('THEN should respond 401 Unauthorized', async () => {
        const response = await request(httpServer).delete('/patients/4');

        expect(response.status).toBe(401);
      });
    });
  });
});
