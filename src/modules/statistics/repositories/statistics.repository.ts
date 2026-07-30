import { Injectable } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { User } from '../../user/entities/user.entity';
import { QueryAnalyticsOverviewDto } from '../dtos/query-analytics-overview.dto';
import { Patient } from '../../patient/entities/patient.entity';

/** A patient's cohort-relevant fields for the ward overview (post-filter). */
export interface CohortPatient {
  caseId: string;
  currentPod: number | null;
  podStartDate: Date | null;
}

export interface SymptomTrendQuestionRow {
  pod: number;
  questionId: number;
  questionText: string;
  orderNumber: number | null;
  avgScore: number;
}

export interface SymptomTrendPodRow {
  pod: number;
  avgTotalScore: number;
  assessmentCount: number;
  patientCount: number;
  redCount: number;
  yellowCount: number;
  greenCount: number;
}

export interface DefaultQuestionRow {
  questionId: number;
  questionText: string;
  orderNumber: number | null;
}

export interface ComplianceRow {
  caseId: string;
  actual: number;
}

export interface HoldRollbackCounts {
  holdCount: number;
  rollbackCount: number;
}

export interface LastHoldRow {
  holdReason: string | null;
  holdAt: Date;
}

export interface AlertCounts {
  redCount: number;
  yellowCount: number;
}

export interface EngagementSummaryRow {
  viewedGuidance: boolean;
  viewedEducation: boolean;
  reminderCount: number;
  appAccessCount: number;
}

export interface AssessmentDetailCellRow {
  pod: number;
  questionId: number;
  questionText: string;
  orderNumber: number | null;
  score: number;
  optionText: string;
}

export interface LatestAssessmentByPodRow {
  assessmentId: number;
  pod: number;
}

/**
 * Raw/QueryBuilder read-only repository for the nurse analytics dashboard.
 * Reads span the patient, alert, symptom-survey tables plus the two new
 * engagement/tracking-log tables — every COUNT/SUM is cast `::int` and every
 * AVG is cast `::float8` since the `pg` driver otherwise returns bigint/numeric
 * aggregates as strings.
 */
@Injectable()
export class StatisticsRepository {
  constructor(
    @InjectRepository(Patient)
    private readonly patientRepo: Repository<Patient>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  // ── Ward-level cohort ────────────────────────────────────────────────────

  /** Patients matching the same filter vocabulary as GET /patients (minus pagination). */
  async findCohort(query: QueryAnalyticsOverviewDto): Promise<CohortPatient[]> {
    const qb = this.patientRepo
      .createQueryBuilder('patient')
      .leftJoin('patient.level', 'level')
      .leftJoin(User, 'account', 'account.caseId = patient.caseId AND account.deletedAt IS NULL')
      .select(['patient.caseId', 'patient.currentPod', 'patient.podStartDate'])
      .where('patient.deletedAt IS NULL')
      .andWhere('patient.erasCompleted = false');

    if (query.search) {
      qb.andWhere('(patient.caseId ILIKE :search OR account.fullName ILIKE :search)', {
        search: `%${query.search}%`,
      });
    }
    if (query.level) {
      qb.andWhere('level.levelName = :level', { level: query.level });
    }
    if (query.operationTypeId !== undefined) {
      qb.andWhere('patient.operationTypeId = :operationTypeId', {
        operationTypeId: query.operationTypeId,
      });
    }
    if (query.room) {
      qb.andWhere("split_part(patient.room_bed, '/', 1) = :room", { room: query.room });
    }

    const patients = await qb.getMany();
    return patients.map((p) => ({
      caseId: p.caseId,
      currentPod: p.currentPod,
      podStartDate: p.podStartDate,
    }));
  }

  /** Per-question average score, grouped by (pod_context, question_id), default questions only. */
  async getSymptomTrendQuestionRows(caseIds: string[]): Promise<SymptomTrendQuestionRow[]> {
    if (caseIds.length === 0) return [];
    return this.dataSource.query<SymptomTrendQuestionRow[]>(
      `
      SELECT
        pa.pod_context                 AS pod,
        pad.question_id                AS "questionId",
        sq.question_text               AS "questionText",
        sq.order_number                AS "orderNumber",
        AVG(pad.score_earned)::float8  AS "avgScore"
      FROM patient_assessments pa
      JOIN patient_assessment_details pad ON pad.assessment_id = pa.assessment_id
      JOIN survey_questions sq ON sq.question_id = pad.question_id
      WHERE pa.case_id = ANY($1)
        AND pa.pod_context IS NOT NULL
        AND sq.is_default = true
      GROUP BY pa.pod_context, pad.question_id, sq.question_text, sq.order_number
      ORDER BY pa.pod_context, sq.order_number NULLS LAST
      `,
      [caseIds],
    );
  }

  /** Per-POD aggregate: total score / assessment count / triage color breakdown. */
  async getSymptomTrendPodRows(caseIds: string[]): Promise<SymptomTrendPodRow[]> {
    if (caseIds.length === 0) return [];
    return this.dataSource.query<SymptomTrendPodRow[]>(
      `
      SELECT
        pa.pod_context                                                AS pod,
        AVG(pa.total_score)::float8                                   AS "avgTotalScore",
        COUNT(*)::int                                                 AS "assessmentCount",
        COUNT(DISTINCT pa.case_id)::int                               AS "patientCount",
        COUNT(*) FILTER (WHERE pa.triage_color = 'RED')::int          AS "redCount",
        COUNT(*) FILTER (WHERE pa.triage_color = 'YELLOW')::int       AS "yellowCount",
        COUNT(*) FILTER (WHERE pa.triage_color = 'GREEN')::int        AS "greenCount"
      FROM patient_assessments pa
      WHERE pa.case_id = ANY($1)
        AND pa.pod_context IS NOT NULL
      GROUP BY pa.pod_context
      ORDER BY pa.pod_context
      `,
      [caseIds],
    );
  }

  /** The default (is_default = true) screening questions, ordered for the symptom trend chart. */
  async getDefaultQuestions(): Promise<DefaultQuestionRow[]> {
    return this.dataSource.query<DefaultQuestionRow[]>(`
      SELECT question_id AS "questionId", question_text AS "questionText", order_number AS "orderNumber"
      FROM survey_questions
      WHERE is_default = true
      ORDER BY order_number NULLS LAST, question_id
    `);
  }

  /** COUNT(DISTINCT pod_context) up to (and including) each patient's current POD. */
  async getComplianceActualCounts(
    cases: Array<{ caseId: string; currentPod: number | null }>,
  ): Promise<ComplianceRow[]> {
    const withPod = cases.filter((c) => c.currentPod !== null);
    if (withPod.length === 0) return [];
    const caseIds = withPod.map((c) => c.caseId);
    return this.dataSource.query<ComplianceRow[]>(
      `
      SELECT pa.case_id                          AS "caseId",
             COUNT(DISTINCT pa.pod_context)::int AS actual
      FROM patient_assessments pa
      JOIN patient_cases pc ON pc.case_id = pa.case_id
      WHERE pa.case_id = ANY($1)
        AND pa.pod_context IS NOT NULL
        AND pa.pod_context <= pc.current_pod
      GROUP BY pa.case_id
      `,
      [caseIds],
    );
  }

  // ── Per-patient: recovery matrix ─────────────────────────────────────────

  async getHoldRollbackCounts(caseId: string): Promise<HoldRollbackCounts> {
    const rows = await this.dataSource.query<Array<{ holdCount: number; rollbackCount: number }>>(
      `
      SELECT
        COUNT(*) FILTER (WHERE action_type = 'Nurse_Pause')::int    AS "holdCount",
        COUNT(*) FILTER (WHERE action_type = 'Nurse_Rollback')::int AS "rollbackCount"
      FROM pod_protocol_tracking_logs
      WHERE case_id = $1
      `,
      [caseId],
    );
    return rows[0] ?? { holdCount: 0, rollbackCount: 0 };
  }

  async getLastHold(caseId: string): Promise<LastHoldRow | null> {
    const rows = await this.dataSource.query<LastHoldRow[]>(
      `
      SELECT hold_reason AS "holdReason", changed_at AS "holdAt"
      FROM pod_protocol_tracking_logs
      WHERE case_id = $1 AND action_type = 'Nurse_Pause'
      ORDER BY changed_at DESC
      LIMIT 1
      `,
      [caseId],
    );
    return rows[0] ?? null;
  }

  async getAlertCounts(caseId: string): Promise<AlertCounts> {
    const rows = await this.dataSource.query<Array<{ redCount: number; yellowCount: number }>>(
      `
      SELECT
        COUNT(*) FILTER (WHERE alert_type = 'RED')::int    AS "redCount",
        COUNT(*) FILTER (WHERE alert_type = 'YELLOW')::int AS "yellowCount"
      FROM monitoring_alerts
      WHERE case_id = $1
      `,
      [caseId],
    );
    return rows[0] ?? { redCount: 0, yellowCount: 0 };
  }

  // ── Per-patient: compliance ──────────────────────────────────────────────

  /** Whether any app_engagement_logs row exists for this case (rows are never guaranteed to exist). */
  async getEngagementSummary(caseId: string): Promise<EngagementSummaryRow | null> {
    const rows = await this.dataSource.query<EngagementSummaryRow[]>(
      `
      SELECT
        COALESCE(bool_or(viewed_guidance), false)  AS "viewedGuidance",
        COALESCE(bool_or(viewed_education), false) AS "viewedEducation",
        COALESCE(SUM(reminder_count), 0)::int      AS "reminderCount",
        COALESCE(SUM(app_access_count), 0)::int    AS "appAccessCount"
      FROM app_engagement_logs
      WHERE case_id = $1
      `,
      [caseId],
    );
    // The aggregate query always returns exactly one row (even with zero matches, due to
    // the aggregate functions) — use a separate EXISTS check to tell "no rows" apart from
    // "rows exist but all counters are zero".
    const exists = await this.dataSource.query<Array<{ exists: boolean }>>(
      `SELECT EXISTS(SELECT 1 FROM app_engagement_logs WHERE case_id = $1) AS "exists"`,
      [caseId],
    );
    if (!exists[0]?.exists) return null;
    return rows[0] ?? null;
  }

  /** COUNT(DISTINCT pod_context) from patient_assessments — the authoritative completed-assessment count. */
  async getAssessmentCompletedCount(caseId: string): Promise<number> {
    const rows = await this.dataSource.query<Array<{ count: number }>>(
      `
      SELECT COUNT(DISTINCT pod_context)::int AS count
      FROM patient_assessments
      WHERE case_id = $1 AND pod_context IS NOT NULL
      `,
      [caseId],
    );
    return rows[0]?.count ?? 0;
  }

  // ── Per-patient: assessment matrix ───────────────────────────────────────

  /** Latest submission per POD (dedupes multiple same-day submissions). */
  async getLatestAssessmentIdsByPod(caseId: string): Promise<LatestAssessmentByPodRow[]> {
    return this.dataSource.query<LatestAssessmentByPodRow[]>(
      `
      SELECT DISTINCT ON (pod_context)
        assessment_id AS "assessmentId",
        pod_context   AS pod
      FROM patient_assessments
      WHERE case_id = $1 AND pod_context IS NOT NULL
      ORDER BY pod_context, evaluation_datetime DESC
      `,
      [caseId],
    );
  }

  /** Answer cells (question/score/option) for a fixed set of (deduped) assessment ids. */
  async getAssessmentDetailCells(assessmentIds: number[]): Promise<AssessmentDetailCellRow[]> {
    if (assessmentIds.length === 0) return [];
    return this.dataSource.query<AssessmentDetailCellRow[]>(
      `
      SELECT
        pa.pod_context     AS pod,
        pad.question_id    AS "questionId",
        sq.question_text   AS "questionText",
        sq.order_number    AS "orderNumber",
        pad.score_earned   AS score,
        qo.option_text     AS "optionText"
      FROM patient_assessment_details pad
      JOIN patient_assessments pa ON pa.assessment_id = pad.assessment_id
      JOIN survey_questions sq ON sq.question_id = pad.question_id
      JOIN question_options qo ON qo.option_id = pad.selected_option_id
      WHERE pad.assessment_id = ANY($1)
      `,
      [assessmentIds],
    );
  }

  /** Every question this patient has answered at least once, across all their assessments. */
  async getAnsweredQuestions(caseId: string): Promise<DefaultQuestionRow[]> {
    return this.dataSource.query<DefaultQuestionRow[]>(
      `
      SELECT DISTINCT
        sq.question_id   AS "questionId",
        sq.question_text AS "questionText",
        sq.order_number  AS "orderNumber"
      FROM patient_assessment_details pad
      JOIN patient_assessments pa ON pa.assessment_id = pad.assessment_id
      JOIN survey_questions sq ON sq.question_id = pad.question_id
      WHERE pa.case_id = $1
      `,
      [caseId],
    );
  }

  async getUnassignedAssessmentCount(caseId: string): Promise<number> {
    const rows = await this.dataSource.query<Array<{ count: number }>>(
      `
      SELECT COUNT(*)::int AS count
      FROM patient_assessments
      WHERE case_id = $1 AND pod_context IS NULL
      `,
      [caseId],
    );
    return rows[0]?.count ?? 0;
  }
}
