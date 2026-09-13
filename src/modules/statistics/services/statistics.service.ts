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
import { PaginatedPatientComplianceListDto } from '../dtos/patient-compliance-list-response.dto';
import { PatientComplianceResponseDto } from '../dtos/patient-compliance-response.dto';
import { QueryAnalyticsOverviewDto } from '../dtos/query-analytics-overview.dto';
import { QueryPatientComplianceListDto } from '../dtos/query-patient-compliance-list.dto';
import { RecoveryMatrixResponseDto } from '../dtos/recovery-matrix-response.dto';
import {
  AssessmentSlotStatusRow,
  DefaultQuestionRow,
  EngagementSummaryRow,
  StatisticsRepository,
} from '../repositories/statistics.repository';

/**
 * A patient is "compliant" once they've completed BOTH periodic assessments
 * (MORNING and AFTERNOON) for >= 80% of elapsed POD days (expected = currentPod
 * + 1; actual = POD days with both scheduled tasks COMPLETED, <= currentPod).
 */
export const COMPLIANCE_THRESHOLD = 0.8;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

@Injectable()
export class StatisticsService {
  constructor(
    private readonly repository: StatisticsRepository,
    private readonly patientRepository: PatientRepository,
  ) {}

  // ── Ward overview ─────────────────────────────────────────────────────────

  async getOverview(query: QueryAnalyticsOverviewDto): Promise<AnalyticsOverviewResponseDto> {
    const cohort = await this.repository.findCohort(query);
    const caseIds = cohort.map((c) => c.caseId);
    const pods = cohort
      .map((c) => c.currentPod)
      .filter((p): p is number => p !== null && p !== undefined);
    const maxPod = pods.length > 0 ? Math.max(...pods) : null;

    // ── Symptom trend (triage count per POD) ─────────────────────────────────
    const podRows = await this.repository.getSymptomTrendPodRows(caseIds);
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

  /**
   * Threshold/rate math shared by GET .../compliance (single patient) and
   * GET /patients/analytics/compliance-list (batch) — kept in one place so
   * the two endpoints can never drift apart.
   */
  private computeComplianceFields(params: {
    currentPod: number | null;
    assessmentCompletedCount: number;
    engagement: EngagementSummaryRow | null;
    slots: AssessmentSlotStatusRow[];
  }): {
    viewedGuidance: boolean;
    viewedEducation: boolean;
    expectedAssessmentCount: number;
    complianceRate: number;
    isCompliant: boolean;
    morningAssessmentStatus: 'PENDING' | 'COMPLETED' | 'MISSED' | null;
    afternoonAssessmentStatus: 'PENDING' | 'COMPLETED' | 'MISSED' | null;
    isDailyCompliant: boolean;
  } {
    const { currentPod, assessmentCompletedCount, engagement, slots } = params;

    const expectedAssessmentCount = currentPod !== null ? currentPod + 1 : 0;
    const complianceRate =
      expectedAssessmentCount > 0 ? assessmentCompletedCount / expectedAssessmentCount : 0;

    const slotStatus = (slot: 'MORNING' | 'AFTERNOON') =>
      currentPod === null
        ? null
        : (slots.find((s) => s.scheduledSlot === slot)?.status ?? 'PENDING');
    const morningAssessmentStatus = slotStatus('MORNING');
    const afternoonAssessmentStatus = slotStatus('AFTERNOON');

    const viewedGuidance = engagement?.viewedGuidance ?? false;
    const viewedEducation = engagement?.viewedEducation ?? false;

    return {
      viewedGuidance,
      viewedEducation,
      expectedAssessmentCount,
      complianceRate,
      isCompliant: complianceRate >= COMPLIANCE_THRESHOLD,
      morningAssessmentStatus,
      afternoonAssessmentStatus,
      isDailyCompliant:
        viewedGuidance &&
        viewedEducation &&
        morningAssessmentStatus === 'COMPLETED' &&
        afternoonAssessmentStatus === 'COMPLETED',
    };
  }

  async getPatientCompliance(caseId: string): Promise<PatientComplianceResponseDto> {
    const patient = await this.patientRepository.findById(caseId);
    if (!patient) throw new NotFoundException(`Patient ${caseId} not found`);

    const currentPod = patient.currentPod;
    const [engagement, assessmentCompletedCount, todaySlots] = await Promise.all([
      this.repository.getEngagementSummary(caseId),
      this.repository.getAssessmentCompletedCount(caseId),
      currentPod !== null
        ? this.repository.getAssessmentSlotStatuses(caseId, currentPod)
        : Promise.resolve([]),
    ]);

    const compliance = this.computeComplianceFields({
      currentPod,
      assessmentCompletedCount,
      engagement,
      slots: todaySlots,
    });

    return {
      caseId,
      currentPod,
      hasEngagementLog: engagement !== null,
      reminderCount: engagement?.reminderCount ?? 0,
      appAccessCount: engagement?.appAccessCount ?? 0,
      assessmentCompletedCount,
      ...compliance,
    };
  }

  // ── Ward-level: paginated compliance-checklist list ──────────────────────

  /**
   * Paginated, filterable list of patients + their compliance-checklist
   * status for the Nurse Dashboard "Non-Compliant Patients Detail Screen"
   * (SEP490-414). Fetches the full matching cohort, batches the
   * engagement/assessment reads (no N+1), computes per-row compliance via
   * `computeComplianceFields` (same logic as GET .../compliance), applies the
   * checklist-specific filters in-memory, then paginates.
   */
  async getComplianceList(
    query: QueryPatientComplianceListDto,
  ): Promise<PaginatedPatientComplianceListDto> {
    const cohort = await this.repository.findCohortWithIdentity(query);
    const caseIds = cohort.map((c) => c.caseId);
    const podPairs = cohort
      .filter((c): c is (typeof cohort)[number] & { currentPod: number } => c.currentPod !== null)
      .map((c) => ({ caseId: c.caseId, pod: c.currentPod }));

    const [engagementMap, completedMap, slotMap] = await Promise.all([
      this.repository.getEngagementSummaryBatch(caseIds),
      this.repository.getAssessmentCompletedCountBatch(caseIds),
      this.repository.getAssessmentSlotStatusesBatch(podPairs),
    ]);

    let rows = cohort.map((patient) => {
      const compliance = this.computeComplianceFields({
        currentPod: patient.currentPod,
        assessmentCompletedCount: completedMap.get(patient.caseId) ?? 0,
        engagement: engagementMap.get(patient.caseId) ?? null,
        slots: slotMap.get(patient.caseId) ?? [],
      });
      return {
        caseId: patient.caseId,
        fullName: patient.fullName,
        roomBed: patient.roomBed,
        currentPod: patient.currentPod,
        level: patient.level,
        viewedGuidance: compliance.viewedGuidance,
        viewedEducation: compliance.viewedEducation,
        morningAssessmentStatus: compliance.morningAssessmentStatus,
        afternoonAssessmentStatus: compliance.afternoonAssessmentStatus,
        complianceRate: compliance.complianceRate,
        isCompliant: compliance.isCompliant,
        isDailyCompliant: compliance.isDailyCompliant,
      };
    });

    if (query.overallStatus && query.overallStatus !== 'ALL') {
      const wantCompliant = query.overallStatus === 'COMPLIANT';
      rows = rows.filter((r) => r.isCompliant === wantCompliant);
    }
    if (query.dietaryNotViewed) {
      rows = rows.filter((r) => !r.viewedGuidance);
    }
    if (query.healthEducationNotViewed) {
      rows = rows.filter((r) => !r.viewedEducation);
    }
    if (query.missedMorning) {
      rows = rows.filter((r) => r.morningAssessmentStatus === 'MISSED');
    }
    if (query.missedAfternoon) {
      rows = rows.filter((r) => r.afternoonAssessmentStatus === 'MISSED');
    }
    if (query.missedBoth) {
      rows = rows.filter(
        (r) => r.morningAssessmentStatus === 'MISSED' && r.afternoonAssessmentStatus === 'MISSED',
      );
    }

    const total = rows.length;
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const data = rows.slice((page - 1) * limit, (page - 1) * limit + limit);

    return { data, total, page, limit };
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

    const cellMap = new Map<
      string,
      { triageLevel: 'GREEN' | 'YELLOW' | 'RED' | null; optionText: string }
    >();
    for (const c of cells) {
      cellMap.set(`${c.questionId}-${c.pod}`, {
        triageLevel: c.triageLevel,
        optionText: c.optionText,
      });
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
            ? { pod, submitted: true, triageLevel: hit.triageLevel, optionText: hit.optionText }
            : { pod, submitted: false, triageLevel: null, optionText: null };
        }),
      })),
      unassignedAssessmentCount,
    };
  }
}
