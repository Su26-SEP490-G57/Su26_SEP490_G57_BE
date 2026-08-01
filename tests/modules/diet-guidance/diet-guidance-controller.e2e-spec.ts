import 'dotenv/config';
import type { Server } from 'http';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { getDataSourceToken } from '@nestjs/typeorm';
import request from 'supertest';
import { DataSource, Repository } from 'typeorm';
import { AppModule } from '../../../src/app.module';
import { TimezoneInterceptor } from '../../../src/common/interceptors/timezone.interceptor';
import { LoginResponse } from '../../../src/modules/auth/services/auth.service';
import { OperationTypeResponseDto } from '../../../src/modules/diet-guidance/dtos/operation-type.dto';
import { PodProtocolResponseDto } from '../../../src/modules/diet-guidance/dtos/pod-protocol.dto';
import { PodProtocol } from '../../../src/modules/diet-guidance/entities/pod-protocol.entity';
import { OperationType } from '../../../src/modules/patient/entities/operation-type.entity';
import { UserRoleName } from '../../../src/modules/user/enums/user-role.enum';
import { authed, login } from '../../global/auth-helpers';
import {
  getTestDataSource,
  resetTestDataSource,
  closeTestDataSource,
} from '../../global/db-context';

// Fixed IDs assigned by src/database/seeds/seed.ts: OperationType 1 is the
// Gastric pathway (6 pods), OperationType 2 is the Colorectal pathway (5 pods).
// PodProtocol.podId is a real Postgres SERIAL though — seed.ts's literal
// podId: 0..5 values are ignored by TypeORM for a @PrimaryGeneratedColumn, so
// pod rows are looked up by (operationTypeId, label) instead of by a assumed id.
const GASTRIC_OP_ID = 1;
const COLORECTAL_OP_ID = 2;

// Both operation types have active (non-deleted, non-ERAS-completed) seeded
// patients, so both are valid fixtures for "operation type still in use" tests.
// For pods specifically: seeded patient_cases put Gastric patients at
// currentPod 0, 1, 2 and 4 — so Gastric's POD3 and POD5 have no patients and
// are safe to delete, while POD1 (2 patients) is not.
const POD_LABEL_WITH_NO_PATIENTS = 'POD3';
const POD_LABEL_WITH_PATIENTS = 'POD1';

function mapPod(pod: PodProtocol): Omit<PodProtocolResponseDto, 'updatedAt' | 'createdAt'> {
  return {
    podId: pod.podId,
    operationTypeId: pod.operationTypeId,
    label: pod.label,
    mealsPerDayMin: pod.mealsPerDayMin,
    mealsPerDayMax: pod.mealsPerDayMax,
    mealInstruction: pod.mealInstruction,
    volumePerMealMin: pod.volumnPerMealMin,
    volumePerMealMax: pod.volumePerMealMax,
    volumeInstruction: pod.volumeInstruction,
    recommendedFoods: pod.recommendedFoods,
    recommendedDrinks: pod.recommendedDrinks,
  };
}

describe('DietGuidanceController (integration)', () => {
  let app: INestApplication;
  let httpServer: Server;
  let dataSource: DataSource;
  let podRepo: Repository<PodProtocol>;
  let opTypeRepo: Repository<OperationType>;
  let headNurseToken: string;
  let nurseToken: string;

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
    podRepo = dataSource.getRepository(PodProtocol);
    opTypeRepo = dataSource.getRepository(OperationType);
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

  describe('GET /diet-guidance/operation-types', () => {
    describe('GIVEN an authenticated caller', () => {
      it('THEN should respond 200 with both seeded operation types and their POD counts', async () => {
        const response = await authed(
          request(httpServer).get('/diet-guidance/operation-types'),
          nurseToken,
        );

        expect(response.status).toBe(200);
        const body = response.body as OperationTypeResponseDto[];
        expect(body).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              id: GASTRIC_OP_ID,
              name: 'Phẫu thuật dạ dày',
              description: null,
              podCount: 6,
            }),
            expect.objectContaining({
              id: COLORECTAL_OP_ID,
              name: 'Phẫu thuật đại trực tràng',
              description: null,
              podCount: 5,
            }),
          ]),
        );
      });
    });

    describe('GIVEN no Authorization header is present', () => {
      it('THEN should respond 401 Unauthorized', async () => {
        const response = await request(httpServer).get('/diet-guidance/operation-types');

        expect(response.status).toBe(401);
      });
    });
  });

  describe('GET /diet-guidance/operation-types/:id', () => {
    describe('GIVEN an operation type id that exists', () => {
      it('THEN should respond 200 with that operation type', async () => {
        const response = await authed(
          request(httpServer).get(`/diet-guidance/operation-types/${GASTRIC_OP_ID}`),
          nurseToken,
        );

        expect(response.status).toBe(200);
        expect(response.body as OperationTypeResponseDto).toEqual(
          expect.objectContaining({
            id: GASTRIC_OP_ID,
            name: 'Phẫu thuật dạ dày',
            podCount: 6,
          }),
        );
      });
    });

    describe('GIVEN an operation type id that does not exist', () => {
      it('THEN should respond 404 Not Found', async () => {
        const response = await authed(
          request(httpServer).get('/diet-guidance/operation-types/999999'),
          nurseToken,
        );

        expect(response.status).toBe(404);
      });
    });
  });

  describe('POST /diet-guidance/operation-types', () => {
    describe('GIVEN a Head Nurse caller and a unique name', () => {
      it('THEN should respond 201 with the created operation type, description defaulted to null and podCount 0', async () => {
        const response = await authed(
          request(httpServer).post('/diet-guidance/operation-types'),
          headNurseToken,
        ).send({ name: 'Phẫu thuật gan mật' });

        expect(response.status).toBe(201);
        expect(response.body as OperationTypeResponseDto).toEqual(
          expect.objectContaining({
            name: 'Phẫu thuật gan mật',
            description: null,
            podCount: 0,
          }),
        );
      });
    });

    describe('GIVEN a name that already exists', () => {
      it('THEN should respond 409 Conflict', async () => {
        const response = await authed(
          request(httpServer).post('/diet-guidance/operation-types'),
          headNurseToken,
        ).send({ name: 'Phẫu thuật dạ dày' });

        expect(response.status).toBe(409);
      });
    });

    describe('GIVEN an empty name', () => {
      it('THEN should respond 400 Bad Request', async () => {
        const response = await authed(
          request(httpServer).post('/diet-guidance/operation-types'),
          headNurseToken,
        ).send({ name: '' });

        expect(response.status).toBe(400);
      });
    });

    describe('GIVEN a caller without the Head Nurse role', () => {
      it('THEN should respond 403 Forbidden', async () => {
        const response = await authed(
          request(httpServer).post('/diet-guidance/operation-types'),
          nurseToken,
        ).send({ name: 'Phẫu thuật gan mật' });

        expect(response.status).toBe(403);
      });
    });

    describe('GIVEN no Authorization header is present', () => {
      it('THEN should respond 401 Unauthorized', async () => {
        const response = await request(httpServer)
          .post('/diet-guidance/operation-types')
          .send({ name: 'Phẫu thuật gan mật' });

        expect(response.status).toBe(401);
      });
    });
  });

  describe('PATCH /diet-guidance/operation-types/:id', () => {
    describe('GIVEN a Head Nurse caller and a new unique name', () => {
      it('THEN should respond 200 with the operation type renamed', async () => {
        const response = await authed(
          request(httpServer).patch(`/diet-guidance/operation-types/${COLORECTAL_OP_ID}`),
          headNurseToken,
        ).send({ name: 'Phẫu thuật đại trực tràng (cập nhật)' });

        expect(response.status).toBe(200);
        expect(response.body as OperationTypeResponseDto).toEqual(
          expect.objectContaining({
            id: COLORECTAL_OP_ID,
            name: 'Phẫu thuật đại trực tràng (cập nhật)',
          }),
        );
      });
    });

    describe('GIVEN an operation type id that does not exist', () => {
      it('THEN should respond 404 Not Found', async () => {
        const response = await authed(
          request(httpServer).patch('/diet-guidance/operation-types/999999'),
          headNurseToken,
        ).send({ name: 'Không tồn tại' });

        expect(response.status).toBe(404);
      });
    });

    describe('GIVEN a name that already belongs to a different operation type', () => {
      it('THEN should respond 409 Conflict', async () => {
        const response = await authed(
          request(httpServer).patch(`/diet-guidance/operation-types/${COLORECTAL_OP_ID}`),
          headNurseToken,
        ).send({ name: 'Phẫu thuật dạ dày' });

        expect(response.status).toBe(409);
      });
    });

    describe('GIVEN a caller without the Head Nurse role', () => {
      it('THEN should respond 403 Forbidden', async () => {
        const response = await authed(
          request(httpServer).patch(`/diet-guidance/operation-types/${COLORECTAL_OP_ID}`),
          nurseToken,
        ).send({ name: 'Tên khác' });

        expect(response.status).toBe(403);
      });
    });
  });

  describe('DELETE /diet-guidance/operation-types/:id', () => {
    describe('GIVEN an operation type with no patients currently using it', () => {
      it('THEN should respond 204 and remove the operation type', async () => {
        const unused = await opTypeRepo.save({ operationName: 'Phẫu thuật chưa dùng' });

        const response = await authed(
          request(httpServer).delete(`/diet-guidance/operation-types/${unused.operationTypeId}`),
          headNurseToken,
        );

        expect(response.status).toBe(204);
        const stored = await opTypeRepo.findOne({
          where: { operationTypeId: unused.operationTypeId },
        });
        expect(stored).toBeNull();
      });
    });

    describe('GIVEN an operation type with active patients currently using it', () => {
      it('THEN should respond 409 Conflict', async () => {
        const response = await authed(
          request(httpServer).delete(`/diet-guidance/operation-types/${GASTRIC_OP_ID}`),
          headNurseToken,
        );

        expect(response.status).toBe(409);
      });
    });

    describe('GIVEN an operation type id that does not exist', () => {
      it('THEN should respond 404 Not Found', async () => {
        const response = await authed(
          request(httpServer).delete('/diet-guidance/operation-types/999999'),
          headNurseToken,
        );

        expect(response.status).toBe(404);
      });
    });

    describe('GIVEN a caller without the Head Nurse role', () => {
      it('THEN should respond 403 Forbidden', async () => {
        const response = await authed(
          request(httpServer).delete(`/diet-guidance/operation-types/${GASTRIC_OP_ID}`),
          nurseToken,
        );

        expect(response.status).toBe(403);
      });
    });
  });

  describe('GET /diet-guidance/operation-types/:opId/pods', () => {
    describe('GIVEN an operation type with PODs', () => {
      it('THEN should respond 200 with all its PODs ordered by label ascending', async () => {
        const response = await authed(
          request(httpServer).get(`/diet-guidance/operation-types/${GASTRIC_OP_ID}/pods`),
          nurseToken,
        );

        expect(response.status).toBe(200);
        const body = response.body as PodProtocolResponseDto[];
        expect(body.map((p) => p.label)).toEqual(['POD0', 'POD1', 'POD2', 'POD3', 'POD4', 'POD5']);
        expect(body.every((p) => p.operationTypeId === GASTRIC_OP_ID)).toBe(true);
      });
    });

    describe('GIVEN an operation type id that does not exist', () => {
      it('THEN should respond 404 Not Found', async () => {
        const response = await authed(
          request(httpServer).get('/diet-guidance/operation-types/999999/pods'),
          nurseToken,
        );

        expect(response.status).toBe(404);
      });
    });
  });

  describe('GET /diet-guidance/operation-types/:opId/pods/:podId', () => {
    describe('GIVEN a POD id that belongs to that operation type', () => {
      it('THEN should respond 200 with the POD detail', async () => {
        const pod = await podRepo.findOneOrFail({
          where: { operationTypeId: GASTRIC_OP_ID, label: POD_LABEL_WITH_PATIENTS },
        });

        const response = await authed(
          request(httpServer).get(
            `/diet-guidance/operation-types/${GASTRIC_OP_ID}/pods/${pod.podId}`,
          ),
          nurseToken,
        );

        expect(response.status).toBe(200);
        expect(response.body as PodProtocolResponseDto).toEqual(
          expect.objectContaining(mapPod(pod)),
        );
      });
    });

    describe('GIVEN a POD id that belongs to a different operation type', () => {
      it('THEN should respond 404 Not Found', async () => {
        const colorectalPod = await podRepo.findOneOrFail({
          where: { operationTypeId: COLORECTAL_OP_ID },
        });

        const response = await authed(
          request(httpServer).get(
            `/diet-guidance/operation-types/${GASTRIC_OP_ID}/pods/${colorectalPod.podId}`,
          ),
          nurseToken,
        );

        expect(response.status).toBe(404);
      });
    });

    describe('GIVEN a POD id that does not exist', () => {
      it('THEN should respond 404 Not Found', async () => {
        const response = await authed(
          request(httpServer).get(`/diet-guidance/operation-types/${GASTRIC_OP_ID}/pods/999999`),
          nurseToken,
        );

        expect(response.status).toBe(404);
      });
    });
  });

  describe('POST /diet-guidance/operation-types/:opId/pods', () => {
    describe('GIVEN a Head Nurse caller and a full POD payload', () => {
      it('THEN should respond 201 with the created POD carrying the given fields', async () => {
        const response = await authed(
          request(httpServer).post(`/diet-guidance/operation-types/${GASTRIC_OP_ID}/pods`),
          headNurseToken,
        ).send({
          label: 'POD-NEW',
          mealsPerDayMin: 4,
          mealsPerDayMax: 6,
          mealInstruction: 'Ăn từng bữa nhỏ',
          volumePerMealMin: 50,
          volumePerMealMax: 80,
          volumeInstruction: 'Uống từng ngụm nhỏ',
          recommendedFoods: ['Cháo loãng'],
          recommendedDrinks: ['Nước ấm'],
        });

        expect(response.status).toBe(201);
        expect(response.body as PodProtocolResponseDto).toEqual(
          expect.objectContaining({
            operationTypeId: GASTRIC_OP_ID,
            label: 'POD-NEW',
            mealsPerDayMin: 4,
            mealsPerDayMax: 6,
            mealInstruction: 'Ăn từng bữa nhỏ',
            volumePerMealMin: 50,
            volumePerMealMax: 80,
            volumeInstruction: 'Uống từng ngụm nhỏ',
            recommendedFoods: ['Cháo loãng'],
            recommendedDrinks: ['Nước ấm'],
          }),
        );
      });
    });

    describe('GIVEN a payload with only the required label', () => {
      it('THEN should respond 201 with recommendedFoods and recommendedDrinks defaulted to empty arrays', async () => {
        const response = await authed(
          request(httpServer).post(`/diet-guidance/operation-types/${GASTRIC_OP_ID}/pods`),
          headNurseToken,
        ).send({ label: 'POD-MINIMAL' });

        expect(response.status).toBe(201);
        expect(response.body as PodProtocolResponseDto).toEqual(
          expect.objectContaining({
            label: 'POD-MINIMAL',
            mealsPerDayMin: null,
            mealsPerDayMax: null,
            recommendedFoods: [],
            recommendedDrinks: [],
          }),
        );
      });
    });

    describe('GIVEN mealsPerDayMin greater than mealsPerDayMax', () => {
      it('THEN should respond 400 Bad Request', async () => {
        const response = await authed(
          request(httpServer).post(`/diet-guidance/operation-types/${GASTRIC_OP_ID}/pods`),
          headNurseToken,
        ).send({ label: 'POD-INVALID', mealsPerDayMin: 10, mealsPerDayMax: 5 });

        expect(response.status).toBe(400);
      });
    });

    describe('GIVEN volumePerMealMin greater than volumePerMealMax', () => {
      it('THEN should respond 400 Bad Request', async () => {
        const response = await authed(
          request(httpServer).post(`/diet-guidance/operation-types/${GASTRIC_OP_ID}/pods`),
          headNurseToken,
        ).send({ label: 'POD-INVALID', volumePerMealMin: 100, volumePerMealMax: 20 });

        expect(response.status).toBe(400);
      });
    });

    describe('GIVEN an operation type id that does not exist', () => {
      it('THEN should respond 404 Not Found', async () => {
        const response = await authed(
          request(httpServer).post('/diet-guidance/operation-types/999999/pods'),
          headNurseToken,
        ).send({ label: 'POD-ORPHAN' });

        expect(response.status).toBe(404);
      });
    });

    describe('GIVEN a caller without the Head Nurse role', () => {
      it('THEN should respond 403 Forbidden', async () => {
        const response = await authed(
          request(httpServer).post(`/diet-guidance/operation-types/${GASTRIC_OP_ID}/pods`),
          nurseToken,
        ).send({ label: 'POD-FORBIDDEN' });

        expect(response.status).toBe(403);
      });
    });
  });

  describe('PATCH /diet-guidance/operation-types/:opId/pods/:podId', () => {
    describe('GIVEN a Head Nurse caller updating the label and meal instruction', () => {
      it('THEN should respond 200 with those fields updated', async () => {
        const pod = await podRepo.findOneOrFail({
          where: { operationTypeId: GASTRIC_OP_ID, label: POD_LABEL_WITH_NO_PATIENTS },
        });

        const response = await authed(
          request(httpServer).patch(
            `/diet-guidance/operation-types/${GASTRIC_OP_ID}/pods/${pod.podId}`,
          ),
          headNurseToken,
        ).send({ label: 'POD3-Updated', mealInstruction: 'Hướng dẫn ăn mới' });

        expect(response.status).toBe(200);
        expect(response.body as PodProtocolResponseDto).toEqual(
          expect.objectContaining({
            podId: pod.podId,
            label: 'POD3-Updated',
            mealInstruction: 'Hướng dẫn ăn mới',
          }),
        );
      });
    });

    describe('GIVEN an update where mealsPerDayMin would exceed mealsPerDayMax', () => {
      it('THEN should respond 400 Bad Request', async () => {
        const pod = await podRepo.findOneOrFail({
          where: { operationTypeId: GASTRIC_OP_ID, label: POD_LABEL_WITH_NO_PATIENTS },
        });

        const response = await authed(
          request(httpServer).patch(
            `/diet-guidance/operation-types/${GASTRIC_OP_ID}/pods/${pod.podId}`,
          ),
          headNurseToken,
        ).send({ label: POD_LABEL_WITH_NO_PATIENTS, mealsPerDayMin: 100, mealsPerDayMax: 5 });

        expect(response.status).toBe(400);
      });
    });

    describe('GIVEN a POD id that does not exist', () => {
      it('THEN should respond 404 Not Found', async () => {
        const response = await authed(
          request(httpServer).patch(`/diet-guidance/operation-types/${GASTRIC_OP_ID}/pods/999999`),
          headNurseToken,
        ).send({ label: 'POD-GHOST' });

        expect(response.status).toBe(404);
      });
    });

    describe('GIVEN a caller without the Head Nurse role', () => {
      it('THEN should respond 403 Forbidden', async () => {
        const pod = await podRepo.findOneOrFail({
          where: { operationTypeId: GASTRIC_OP_ID, label: POD_LABEL_WITH_NO_PATIENTS },
        });

        const response = await authed(
          request(httpServer).patch(
            `/diet-guidance/operation-types/${GASTRIC_OP_ID}/pods/${pod.podId}`,
          ),
          nurseToken,
        ).send({ label: POD_LABEL_WITH_NO_PATIENTS });

        expect(response.status).toBe(403);
      });
    });
  });

  describe('DELETE /diet-guidance/operation-types/:opId/pods/:podId', () => {
    describe('GIVEN a POD with no patients currently at that level', () => {
      it('THEN should respond 204 and remove the POD', async () => {
        const pod = await podRepo.findOneOrFail({
          where: { operationTypeId: GASTRIC_OP_ID, label: POD_LABEL_WITH_NO_PATIENTS },
        });

        const response = await authed(
          request(httpServer).delete(
            `/diet-guidance/operation-types/${GASTRIC_OP_ID}/pods/${pod.podId}`,
          ),
          headNurseToken,
        );

        expect(response.status).toBe(204);
        const stored = await podRepo.findOne({ where: { podId: pod.podId } });
        expect(stored).toBeNull();
      });
    });

    describe('GIVEN a POD with active patients currently at that level', () => {
      it('THEN should respond 409 Conflict', async () => {
        const pod = await podRepo.findOneOrFail({
          where: { operationTypeId: GASTRIC_OP_ID, label: POD_LABEL_WITH_PATIENTS },
        });

        const response = await authed(
          request(httpServer).delete(
            `/diet-guidance/operation-types/${GASTRIC_OP_ID}/pods/${pod.podId}`,
          ),
          headNurseToken,
        );

        expect(response.status).toBe(409);
      });
    });

    describe('GIVEN a POD id that does not exist', () => {
      it('THEN should respond 404 Not Found', async () => {
        const response = await authed(
          request(httpServer).delete(`/diet-guidance/operation-types/${GASTRIC_OP_ID}/pods/999999`),
          headNurseToken,
        );

        expect(response.status).toBe(404);
      });
    });

    describe('GIVEN a caller without the Head Nurse role', () => {
      it('THEN should respond 403 Forbidden', async () => {
        const pod = await podRepo.findOneOrFail({
          where: { operationTypeId: GASTRIC_OP_ID, label: POD_LABEL_WITH_NO_PATIENTS },
        });

        const response = await authed(
          request(httpServer).delete(
            `/diet-guidance/operation-types/${GASTRIC_OP_ID}/pods/${pod.podId}`,
          ),
          nurseToken,
        );

        expect(response.status).toBe(403);
      });
    });
  });
});
