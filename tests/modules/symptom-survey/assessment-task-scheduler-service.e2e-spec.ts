import 'dotenv/config';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { getDataSourceToken } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { AppModule } from '../../../src/app.module';
import { AssessmentTaskSchedulerService } from '../../../src/modules/symptom-survey/services/assessment-task-scheduler.service';
import { AssessmentTask } from '../../../src/modules/symptom-survey/entities/assessment-task.entity';
import { Patient } from '../../../src/modules/patient/entities/patient.entity';
import {
  getTestDataSource,
  resetTestDataSource,
  closeTestDataSource,
} from '../../global/db-context';

// generateDailyTasks() upserts on the (case_id, pod_context, scheduled_slot) triple.
// In production that conflict target is backed by the UQ_assessment_tasks_case_pod_slot
// constraint created in migration 1785903425779-AddClinicalAssessmentFoundation.ts, but
// this test harness builds its schema via TypeOrmModule `synchronize: true` off entity
// metadata only (no migrations run — see tests/global/db-context.ts), and the
// AssessmentTask entity itself declares no @Unique/@Index for that column combination.
// Without a matching unique index Postgres rejects the upsert's ON CONFLICT clause, so
// this recreates just that one constraint against the shared test DataSource.
async function ensureAssessmentTaskUpsertConstraint(dataSource: DataSource): Promise<void> {
  await dataSource.query(
    'CREATE UNIQUE INDEX IF NOT EXISTS "UQ_assessment_tasks_case_pod_slot_test" ON "assessment_tasks" ("case_id", "pod_context", "scheduled_slot")',
  );
}

// Computes the same day-window Date objects generateDailyTasks() derives from the
// server's local clock, so assertions aren't tied to a specific process TZ.
function expectedWindow(openHour: number, closeHour: number): { opensAt: Date; closesAt: Date } {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const opensAt = new Date(today);
  opensAt.setHours(openHour, 0, 0, 0);
  const closesAt = new Date(today);
  closesAt.setHours(closeHour, 0, 0, 0);
  return { opensAt, closesAt };
}

describe('AssessmentTaskSchedulerService (integration)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let scheduler: AssessmentTaskSchedulerService;
  let patientRepo: Repository<Patient>;
  let taskRepo: Repository<AssessmentTask>;

  beforeAll(async () => {
    dataSource = await getTestDataSource();
    await ensureAssessmentTaskUpsertConstraint(dataSource);

    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(getDataSourceToken())
      .useValue(dataSource)
      .compile();

    app = moduleRef.createNestApplication();
    await app.init();
    scheduler = app.get(AssessmentTaskSchedulerService);
    patientRepo = dataSource.getRepository(Patient);
    taskRepo = dataSource.getRepository(AssessmentTask);
  });

  beforeEach(async () => {
    await resetTestDataSource();
  });

  afterAll(async () => {
    await app.close();
    await closeTestDataSource();
  });

  describe('generateDailyTasks()', () => {
    describe('GIVEN an unlocked patient with a current POD', () => {
      it('THEN creates a PENDING MORNING task and a PENDING AFTERNOON task for today at the fixed windows', async () => {
        // seed.ts seeds CASE-001 with currentPod: 2 and isLocked: false.
        await scheduler.generateDailyTasks();

        const tasks = await taskRepo.find({ where: { caseId: 'CASE-001' } });
        const morning = tasks.find((t) => t.scheduledSlot === 'MORNING');
        const afternoon = tasks.find((t) => t.scheduledSlot === 'AFTERNOON');
        const morningWindow = expectedWindow(6, 8);
        const afternoonWindow = expectedWindow(16, 18);

        expect(tasks).toHaveLength(2);
        expect(morning).toEqual(
          expect.objectContaining({
            podContext: 2,
            status: 'PENDING',
            opensAt: morningWindow.opensAt,
            closesAt: morningWindow.closesAt,
          }),
        );
        expect(afternoon).toEqual(
          expect.objectContaining({
            podContext: 2,
            status: 'PENDING',
            opensAt: afternoonWindow.opensAt,
            closesAt: afternoonWindow.closesAt,
          }),
        );
      });
    });

    describe('GIVEN a locked patient', () => {
      it('THEN creates no tasks for that patient', async () => {
        await patientRepo.update({ caseId: 'CASE-001' }, { isLocked: true });

        await scheduler.generateDailyTasks();

        const count = await taskRepo.count({ where: { caseId: 'CASE-001' } });
        expect(count).toBe(0);
      });
    });

    describe('GIVEN a patient with no current POD assigned', () => {
      it('THEN creates no tasks for that patient', async () => {
        await patientRepo.update({ caseId: 'CASE-001' }, { currentPod: null });

        await scheduler.generateDailyTasks();

        const count = await taskRepo.count({ where: { caseId: 'CASE-001' } });
        expect(count).toBe(0);
      });
    });

    describe('GIVEN the job has already run today for a patient', () => {
      it('THEN re-running it upserts in place instead of creating duplicate tasks', async () => {
        await scheduler.generateDailyTasks();
        const firstRun = await taskRepo.find({ where: { caseId: 'CASE-001' } });

        await scheduler.generateDailyTasks();
        const secondRun = await taskRepo.find({ where: { caseId: 'CASE-001' } });

        expect(secondRun).toHaveLength(2);
        expect(secondRun.map((t) => t.assessmentTaskId).sort()).toEqual(
          firstRun.map((t) => t.assessmentTaskId).sort(),
        );
      });
    });
  });

  describe('markMissedTasks()', () => {
    describe('GIVEN a PENDING task whose closes_at is in the past', () => {
      it('THEN marks it MISSED and records missed_at', async () => {
        const now = new Date();
        const task = await taskRepo.save({
          caseId: 'CASE-001',
          podContext: 2,
          scheduledSlot: 'MORNING',
          opensAt: new Date(now.getTime() - 3 * 60 * 60 * 1000),
          closesAt: new Date(now.getTime() - 60 * 60 * 1000),
          status: 'PENDING',
        });

        await scheduler.markMissedTasks();

        const stored = await taskRepo.findOne({
          where: { assessmentTaskId: task.assessmentTaskId },
        });
        expect(stored).toEqual(
          expect.objectContaining({ status: 'MISSED', missedAt: expect.any(Date) as Date }),
        );
      });
    });

    describe('GIVEN a PENDING task whose closes_at is still in the future', () => {
      it('THEN leaves it PENDING', async () => {
        const now = new Date();
        const task = await taskRepo.save({
          caseId: 'CASE-001',
          podContext: 2,
          scheduledSlot: 'MORNING',
          opensAt: new Date(now.getTime() - 60 * 60 * 1000),
          closesAt: new Date(now.getTime() + 60 * 60 * 1000),
          status: 'PENDING',
        });

        await scheduler.markMissedTasks();

        const stored = await taskRepo.findOne({
          where: { assessmentTaskId: task.assessmentTaskId },
        });
        expect(stored).toEqual(expect.objectContaining({ status: 'PENDING', missedAt: null }));
      });
    });

    describe('GIVEN a task already COMPLETED whose closes_at is in the past', () => {
      it('THEN leaves it COMPLETED rather than overwriting it as MISSED', async () => {
        const now = new Date();
        const task = await taskRepo.save({
          caseId: 'CASE-001',
          podContext: 2,
          scheduledSlot: 'MORNING',
          opensAt: new Date(now.getTime() - 3 * 60 * 60 * 1000),
          closesAt: new Date(now.getTime() - 60 * 60 * 1000),
          status: 'COMPLETED',
          completedAt: new Date(now.getTime() - 90 * 60 * 1000),
        });

        await scheduler.markMissedTasks();

        const stored = await taskRepo.findOne({
          where: { assessmentTaskId: task.assessmentTaskId },
        });
        expect(stored).toEqual(expect.objectContaining({ status: 'COMPLETED', missedAt: null }));
      });
    });
  });
});
