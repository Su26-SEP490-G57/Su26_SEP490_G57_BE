import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PatientRepository } from '../../patient/repositories/patient.repository';
import { UserRoleName } from '../../user/enums/user-role.enum';
import { UserResponseDto } from '../../user/dtos/user-response.dto';
import {
  AnalyticsOverviewResponseDto,
  SymptomTrendPointDto,
} from '../dtos/analytics-overview-response.dto';
import { AssessmentMatrixResponseDto } from '../dtos/assessment-matrix-response.dto';
import { CreateEngagementLogDto } from '../dtos/create-engagement-log.dto';
import { EngagementLogResponseDto } from '../dtos/engagement-log-response.dto';
import { PatientComplianceResponseDto } from '../dtos/patient-compliance-response.dto';
import { QueryAnalyticsOverviewDto } from '../dtos/query-analytics-overview.dto';
import { RecoveryMatrixResponseDto } from '../dtos/recovery-matrix-response.dto';
import { DefaultQuestionRow, StatisticsRepository } from '../repositories/statistics.repository';

/**
 * A patient is "compliant" once they've completed BOTH periodic assessments
 * (MORNING and AFTERNOON) for >= 80% of elapsed POD days (expected = currentPod
 * + 1; actual = POD days with both scheduled tasks COMPLETED, <= currentPod).
 */
export const COMPLIANCE_THRESHOLD = 0.8;

/**
 * question_text -> stable camelCase key for the 5 built-in screening
 * questions seeded by `1780912799-create-core-table.ts`. Any other question
 * later marked `is_default = true` falls back to `question_<id>` so the chart
 * never silently drops a column.
 */
export const DEFAULT_QUESTION_KEY_BY_TEXT: Record<string, string> = {
  'Bạn có buồn nôn không?': 'nausea',
  'Bạn có nôn nhiều không?': 'vomiting',
  'Bạn có chướng bụng không?': 'bloating',
  'Bạn ăn được bao nhiêu?': 'foodIntake',
  'Bạn đã trung tiện chưa?': 'flatus',
};

const MS_PER_DAY = 24 * 60 * 60 * 1000;

@Injectable()
export class StatisticsService {
  constructor(
    private readonly repository: StatisticsRepository,
    private readonly patientRepository: PatientRepository,
  ) {}

  private questionKey(q: { questionId: number; questionText: string }): string {
    return DEFAULT_QUESTION_KEY_BY_TEXT[q.questionText] ?? `question_${q.questionId}`;
  }

  // ── Ward overview ─────────────────────────────────────────────────────────

  async getOverview(query: QueryAnalyticsOverviewDto): Promise<AnalyticsOverviewResponseDto> {
    const cohort = await this.repository.findCohort(query);
    const caseIds = cohort.map((c) => c.caseId);
    const pods = cohort
      .map((c) => c.currentPod)
      .filter((p): p is number => p !== null && p !== undefined);
    const maxPod = pods.length > 0 ? Math.max(...pods) : null;

    // ── Symptom trend (zero-filled 0..maxPod in this layer, never in SQL) ───
    const defaultQuestions = await this.repository.getDefaultQuestions();
    const [questionRows, podRows] = await Promise.all([
      this.repository.getSymptomTrendQuestionRows(caseIds),
      this.repository.getSymptomTrendPodRows(caseIds),
    ]);

    const questionRowMap = new Map<string, number>();
    for (const r of questionRows) {
      questionRowMap.set(`${r.pod}-${r.questionId}`, r.avgScore);
    }
    const podRowMap = new Map<number, (typeof podRows)[number]>();
    for (const r of podRows) {
      podRowMap.set(r.pod, r);
    }

    const symptomTrend: SymptomTrendPointDto[] = [];
    if (maxPod !== null) {
      for (let pod = 0; pod <= maxPod; pod++) {
        const podAgg = podRowMap.get(pod);
        symptomTrend.push({
          pod,
          questions: defaultQuestions.map((q) => ({
            questionId: q.questionId,
            questionKey: this.questionKey(q),
            avgScore: questionRowMap.get(`${pod}-${q.questionId}`) ?? 0,
          })),
          avgTotalScore: podAgg?.avgTotalScore ?? 0,
          assessmentCount: podAgg?.assessmentCount ?? 0,
          patientCount: podAgg?.patientCount ?? 0,
          redCount: podAgg?.redCount ?? 0,
          yellowCount: podAgg?.yellowCount ?? 0,
          greenCount: podAgg?.greenCount ?? 0,
        });
      }
    }

    // ── Compliance ────────────────────────────────────────────────────────
    const erasStarted = cohort.filter((c) => c.podStartDate !== null);
    const actualRows = await this.repository.getComplianceActualCounts(
      erasStarted.map((c) => ({ caseId: c.caseId, currentPod: c.currentPod })),
    );
    const actualMap = new Map(actualRows.map((r) => [r.caseId, r.actual]));

    let compliant = 0;
    let nonCompliant = 0;
    for (const c of erasStarted) {
      const currentPod = c.currentPod ?? 0;
      const expected = currentPod + 1;
      const actual = actualMap.get(c.caseId) ?? 0;
      const rate = expected > 0 ? actual / expected : 0;
      if (rate >= COMPLIANCE_THRESHOLD) compliant++;
      else nonCompliant++;
    }
    const notStarted = cohort.length - erasStarted.length;
    const judged = compliant + nonCompliant;
    const complianceRate = judged > 0 ? compliant / judged : 0;

    return {
      filters: {
        search: query.search,
        level: query.level,
        operationTypeId: query.operationTypeId,
        room: query.room,
      },
      patientCount: cohort.length,
      maxPod,
      symptomTrend,
      compliance: {
        compliant,
        nonCompliant,
        notStarted,
        total: cohort.length,
        complianceRate,
        threshold: COMPLIANCE_THRESHOLD,
      },
    };
  }

  // ── Per-patient: recovery matrix ─────────────────────────────────────────

  async getRecoveryMatrix(caseId: string): Promise<RecoveryMatrixResponseDto> {
    const patient = await this.patientRepository.findByIdWithRelations(caseId);
    if (!patient) throw new NotFoundException(`Patient ${caseId} not found`);

    const [holdRollback, lastHold, alerts] = await Promise.all([
      this.repository.getHoldRollbackCounts(caseId),
      this.repository.getLastHold(caseId),
      this.repository.getAlertCounts(caseId),
    ]);

    let totalPodDays: number | null = null;
    if (patient.podStartDate) {
      const end = patient.dischargeDate ?? new Date();
      totalPodDays = Math.floor(
        (new Date(end).getTime() - new Date(patient.podStartDate).getTime()) / MS_PER_DAY,
      );
    }

    return {
      caseId: patient.caseId,
      fullName: patient.account?.fullName ?? null,
      roomBed: patient.roomBed,
      currentPod: patient.currentPod,
      level: patient.level ? { id: patient.level.levelId, name: patient.level.levelName } : null,
      operationType: patient.operationType
        ? { id: patient.operationType.operationTypeId, name: patient.operationType.operationName }
        : null,
      milestones: {
        timeToRedrink: patient.timeToRedrink,
        timeToReeat: patient.timeToReeat,
        podSoftDietReached: patient.podSoftDietReached,
        timeToFlatus: patient.timeToFlatus,
        timeToDefecation: patient.timeToDefecation,
      },
      summary: {
        totalPodDays,
        isDischarged: patient.dischargeDate != null,
        lengthOfStay: patient.lengthOfStay,
        holdCount: holdRollback.holdCount,
        rollbackCount: holdRollback.rollbackCount,
        currentlyOnHold: patient.isLocked,
        holdStartedAt: patient.lockedAt,
        lastHoldReason: lastHold?.holdReason ?? null,
        lastHoldAt: lastHold?.holdAt ?? null,
        redAlertCount: alerts.redCount,
        yellowAlertCount: alerts.yellowCount,
        giComplications: patient.giComplications,
        protocolFinalStatus: patient.protocolFinalStatus,
        erasCompleted: patient.erasCompleted,
      },
    };
  }

  // ── Per-patient: compliance ───────────────────────────────────────────────

  async getPatientCompliance(caseId: string): Promise<PatientComplianceResponseDto> {
    const patient = await this.patientRepository.findById(caseId);
    if (!patient) throw new NotFoundException(`Patient ${caseId} not found`);

    const [engagement, assessmentCompletedCount] = await Promise.all([
      this.repository.getEngagementSummary(caseId),
      this.repository.getAssessmentCompletedCount(caseId),
    ]);

    const currentPod = patient.currentPod;
    const expectedAssessmentCount = currentPod !== null ? currentPod + 1 : 0;
    const complianceRate =
      expectedAssessmentCount > 0 ? assessmentCompletedCount / expectedAssessmentCount : 0;

    return {
      caseId,
      currentPod,
      hasEngagementLog: engagement !== null,
      viewedGuidance: engagement?.viewedGuidance ?? false,
      viewedEducation: engagement?.viewedEducation ?? false,
      reminderCount: engagement?.reminderCount ?? 0,
      appAccessCount: engagement?.appAccessCount ?? 0,
      assessmentCompletedCount,
      expectedAssessmentCount,
      complianceRate,
      isCompliant: complianceRate >= COMPLIANCE_THRESHOLD,
    };
  }

  /** Called by the patient app when guidance/education content is viewed. */
  async logEngagement(
    caseId: string,
    dto: CreateEngagementLogDto,
    caller: UserResponseDto,
  ): Promise<EngagementLogResponseDto> {
    if (caller.roles.includes(UserRoleName.PATIENT) && caller.caseId !== caseId) {
      throw new ForbiddenException('You can only log engagement for your own case');
    }
    if (dto.viewedGuidance === undefined && dto.viewedEducation === undefined) {
      throw new BadRequestException('At least one engagement field must be provided');
    }

    const patient = await this.patientRepository.findById(caseId);
    if (!patient) throw new NotFoundException(`Patient ${caseId} not found`);

    const log = await this.repository.createEngagementLog(caseId, dto);
    return {
      caseId: log.caseId,
      viewedGuidance: log.viewedGuidance,
      viewedEducation: log.viewedEducation,
    };
  }

  // ── Per-patient: assessment matrix ───────────────────────────────────────

  async getAssessmentMatrix(caseId: string): Promise<AssessmentMatrixResponseDto> {
    const patient = await this.patientRepository.findById(caseId);
    if (!patient) throw new NotFoundException(`Patient ${caseId} not found`);

    const [defaultQuestions, answeredQuestions, latestByPod, unassignedAssessmentCount] =
      await Promise.all([
        this.repository.getDefaultQuestions(),
        this.repository.getAnsweredQuestions(caseId),
        this.repository.getLatestAssessmentIdsByPod(caseId),
        this.repository.getUnassignedAssessmentCount(caseId),
      ]);

    const cells = await this.repository.getAssessmentDetailCells(
      latestByPod.map((r) => r.assessmentId),
    );

    // Union: questions actually answered + all default questions, deduped by id.
    const questionMap = new Map<number, DefaultQuestionRow>();
    for (const q of [...defaultQuestions, ...answeredQuestions]) {
      questionMap.set(q.questionId, q);
    }
    const questions = Array.from(questionMap.values()).sort((a, b) => {
      if (a.orderNumber === null && b.orderNumber === null) return a.questionId - b.questionId;
      if (a.orderNumber === null) return 1;
      if (b.orderNumber === null) return -1;
      return a.orderNumber - b.orderNumber;
    });

    const maxPod = patient.currentPod ?? -1;
    const pods = maxPod >= 0 ? Array.from({ length: maxPod + 1 }, (_, i) => i) : [];

    const cellMap = new Map<string, { score: number; optionText: string }>();
    for (const c of cells) {
      cellMap.set(`${c.questionId}-${c.pod}`, { score: c.score, optionText: c.optionText });
    }

    return {
      caseId,
      currentPod: patient.currentPod,
      pods,
      questions: questions.map((q) => ({
        questionId: q.questionId,
        questionText: q.questionText,
        orderNumber: q.orderNumber,
        cells: pods.map((pod) => {
          const hit = cellMap.get(`${q.questionId}-${pod}`);
          return hit
            ? { pod, submitted: true, score: hit.score, optionText: hit.optionText }
            : { pod, submitted: false, score: null, optionText: null };
        }),
      })),
      unassignedAssessmentCount,
    };
  }
}
