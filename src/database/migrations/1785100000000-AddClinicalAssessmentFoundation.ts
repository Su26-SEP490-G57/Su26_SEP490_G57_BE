import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds the additive data-model foundation for the no-score clinical assessment
 * workflow. Existing score columns deliberately remain during this migration so
 * deployed clients keep working until the application cutover is complete.
 */
export class AddClinicalAssessmentFoundation1785100000000 implements MigrationInterface {
  name = 'AddClinicalAssessmentFoundation1785100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const schemaName = process.env.DB_SCHEMA ?? 'public';
    const schema = `"${schemaName}"`;

    // ── Questionnaire versioning ──────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE ${schema}."questionnaire_versions" (
        "questionnaire_version_id" SERIAL NOT NULL,
        "version_number" integer NOT NULL,
        "status" character varying(20) NOT NULL DEFAULT 'DRAFT',
        "published_at" TIMESTAMP WITH TIME ZONE,
        "retired_at" TIMESTAMP WITH TIME ZONE,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_questionnaire_versions_questionnaire_version_id"
          PRIMARY KEY ("questionnaire_version_id"),
        CONSTRAINT "UQ_questionnaire_versions_version_number"
          UNIQUE ("version_number"),
        CONSTRAINT "CHK_questionnaire_versions_status"
          CHECK ("status" IN ('DRAFT', 'ACTIVE', 'RETIRED'))
      )
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_questionnaire_versions_one_active"
      ON ${schema}."questionnaire_versions" ("status")
      WHERE "status" = 'ACTIVE'
    `);

    await queryRunner.query(`
      INSERT INTO ${schema}."questionnaire_versions" ("version_number", "status", "published_at")
      VALUES (1, 'ACTIVE', now())
    `);

    await queryRunner.query(`
      ALTER TABLE ${schema}."survey_questions"
      ADD COLUMN "questionnaire_version_id" integer,
      ADD COLUMN "clinical_dimension" character varying(30)
    `);

    await queryRunner.query(`
      UPDATE ${schema}."survey_questions"
      SET "questionnaire_version_id" = (
        SELECT "questionnaire_version_id"
        FROM ${schema}."questionnaire_versions"
        WHERE "version_number" = 1
      )
    `);

    await queryRunner.query(`
      UPDATE ${schema}."survey_questions"
      SET "clinical_dimension" = CASE "order_number"
        WHEN 1 THEN 'NAUSEA'
        WHEN 2 THEN 'VOMITING'
        WHEN 3 THEN 'BLOATING'
        WHEN 4 THEN 'INTAKE'
        WHEN 5 THEN 'DEFECATION'
        ELSE NULL
      END
    `);

    await queryRunner.query(`
      ALTER TABLE ${schema}."survey_questions"
      ADD CONSTRAINT "CHK_survey_questions_questionnaire_version_id_not_null"
      CHECK ("questionnaire_version_id" IS NOT NULL) NOT VALID
    `);

    await queryRunner.query(`
      ALTER TABLE ${schema}."survey_questions"
      VALIDATE CONSTRAINT "CHK_survey_questions_questionnaire_version_id_not_null"
    `);

    await queryRunner.query(`
      ALTER TABLE ${schema}."survey_questions"
      ALTER COLUMN "questionnaire_version_id" SET NOT NULL
    `);

    await queryRunner.query(`
      ALTER TABLE ${schema}."survey_questions"
      DROP CONSTRAINT "CHK_survey_questions_questionnaire_version_id_not_null"
    `);

    await queryRunner.query(`
      ALTER TABLE ${schema}."survey_questions"
      ADD CONSTRAINT "FK_survey_questions_questionnaire_version"
      FOREIGN KEY ("questionnaire_version_id")
      REFERENCES ${schema}."questionnaire_versions"("questionnaire_version_id")
      ON DELETE RESTRICT ON UPDATE NO ACTION NOT VALID
    `);

    await queryRunner.query(`
      ALTER TABLE ${schema}."survey_questions"
      VALIDATE CONSTRAINT "FK_survey_questions_questionnaire_version"
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_survey_questions_version_dimension"
      ON ${schema}."survey_questions" ("questionnaire_version_id", "clinical_dimension")
      WHERE "clinical_dimension" IS NOT NULL
    `);

    await queryRunner.query(`
      ALTER TABLE ${schema}."question_options"
      ADD COLUMN "option_triage_level" character varying(15),
      ADD COLUMN "option_definition" TEXT,
      ADD COLUMN "normalized_value" smallint
    `);

    // Backfill the legacy five-question survey into the clinical boundary model.
    // Existing option texts are preserved; clinical staff can revise wording through v2.
    await queryRunner.query(`
      UPDATE ${schema}."question_options" o
      SET
        "option_triage_level" = CASE q."clinical_dimension"
          WHEN 'NAUSEA' THEN CASE
            WHEN o."score_value" <= 0 THEN 'GREEN'
            WHEN o."score_value" = 1 THEN 'YELLOW'
            ELSE 'RED'
          END
          WHEN 'VOMITING' THEN CASE
            WHEN o."score_value" <= 0 THEN 'GREEN'
            WHEN o."score_value" = 2 THEN 'YELLOW'
            ELSE 'RED'
          END
          WHEN 'BLOATING' THEN CASE
            WHEN o."score_value" <= 0 THEN 'GREEN'
            WHEN o."score_value" = 1 THEN 'YELLOW'
            ELSE 'RED'
          END
          WHEN 'INTAKE' THEN CASE
            WHEN o."score_value" <= 0 THEN 'GREEN'
            WHEN o."score_value" = 1 THEN 'YELLOW'
            ELSE 'RED'
          END
          WHEN 'DEFECATION' THEN CASE
            WHEN o."score_value" <= 0 THEN 'GREEN'
            ELSE 'YELLOW'
          END
          ELSE NULL
        END,
        "normalized_value" = CASE q."clinical_dimension"
          WHEN 'VOMITING' THEN CASE
            WHEN o."score_value" <= 0 THEN 0
            WHEN o."score_value" = 2 THEN 1
            ELSE 2
          END
          ELSE NULL
        END
      FROM ${schema}."survey_questions" q
      WHERE q."question_id" = o."question_id"
    `);

    await queryRunner.query(`
      ALTER TABLE ${schema}."question_options"
      ADD CONSTRAINT "CHK_question_options_triage_level"
      CHECK ("option_triage_level" IS NULL OR "option_triage_level" IN ('GREEN', 'YELLOW', 'RED')) NOT VALID
    `);

    await queryRunner.query(`
      ALTER TABLE ${schema}."question_options"
      VALIDATE CONSTRAINT "CHK_question_options_triage_level"
    `);

    // ── Assessment audit columns ───────────────────────────────────────────────
    await queryRunner.query(`
      ALTER TABLE ${schema}."patient_assessments"
      ADD COLUMN "assessment_type" character varying(20) NOT NULL DEFAULT 'SCHEDULED',
      ADD COLUMN "scheduled_slot" character varying(20),
      ADD COLUMN "questionnaire_version_id" integer,
      ADD COLUMN "triage_triggers" JSONB NOT NULL DEFAULT '[]'::jsonb
    `);

    await queryRunner.query(`
      UPDATE ${schema}."patient_assessments"
      SET "questionnaire_version_id" = (
        SELECT "questionnaire_version_id"
        FROM ${schema}."questionnaire_versions"
        WHERE "version_number" = 1
      )
    `);

    await queryRunner.query(`
      ALTER TABLE ${schema}."patient_assessments"
      ADD CONSTRAINT "CHK_patient_assessments_questionnaire_version_id_not_null"
      CHECK ("questionnaire_version_id" IS NOT NULL) NOT VALID
    `);

    await queryRunner.query(`
      ALTER TABLE ${schema}."patient_assessments"
      VALIDATE CONSTRAINT "CHK_patient_assessments_questionnaire_version_id_not_null"
    `);

    await queryRunner.query(`
      ALTER TABLE ${schema}."patient_assessments"
      ALTER COLUMN "questionnaire_version_id" SET NOT NULL
    `);

    await queryRunner.query(`
      ALTER TABLE ${schema}."patient_assessments"
      DROP CONSTRAINT "CHK_patient_assessments_questionnaire_version_id_not_null"
    `);

    await queryRunner.query(`
      ALTER TABLE ${schema}."patient_assessments"
      ADD CONSTRAINT "FK_patient_assessments_questionnaire_version"
      FOREIGN KEY ("questionnaire_version_id")
      REFERENCES ${schema}."questionnaire_versions"("questionnaire_version_id")
      ON DELETE RESTRICT ON UPDATE NO ACTION NOT VALID,
      ADD CONSTRAINT "CHK_patient_assessments_type"
      CHECK ("assessment_type" IN ('SCHEDULED', 'TRIGGERED')) NOT VALID,
      ADD CONSTRAINT "CHK_patient_assessments_scheduled_slot"
      CHECK (
        ("assessment_type" = 'SCHEDULED' AND "scheduled_slot" IS NULL)
        OR ("assessment_type" = 'TRIGGERED' AND "scheduled_slot" IS NULL)
        OR "scheduled_slot" IN ('MORNING', 'AFTERNOON')
      ) NOT VALID
    `);

    await queryRunner.query(`
      ALTER TABLE ${schema}."patient_assessments"
      VALIDATE CONSTRAINT "FK_patient_assessments_questionnaire_version"
    `);

    await queryRunner.query(`
      ALTER TABLE ${schema}."patient_assessments"
      VALIDATE CONSTRAINT "CHK_patient_assessments_type"
    `);

    await queryRunner.query(`
      ALTER TABLE ${schema}."patient_assessments"
      VALIDATE CONSTRAINT "CHK_patient_assessments_scheduled_slot"
    `);

    await queryRunner.query(`
      ALTER TABLE ${schema}."patient_assessment_details"
      ADD COLUMN "question_text_snapshot" TEXT NOT NULL DEFAULT '',
      ADD COLUMN "option_text_snapshot" character varying(255) NOT NULL DEFAULT '',
      ADD COLUMN "clinical_dimension_snapshot" character varying(30) NOT NULL DEFAULT '',
      ADD COLUMN "option_triage_level_snapshot" character varying(15) NOT NULL DEFAULT '',
      ADD COLUMN "normalized_value_snapshot" smallint,
      ADD COLUMN "matched_alert_rule_ids" JSONB NOT NULL DEFAULT '[]'::jsonb
    `);

    await queryRunner.query(`
      UPDATE ${schema}."patient_assessment_details"
      SET
        "question_text_snapshot" = q."question_text",
        "option_text_snapshot" = o."option_text",
        "clinical_dimension_snapshot" = COALESCE(q."clinical_dimension", ''),
        "option_triage_level_snapshot" = COALESCE(o."option_triage_level", ''),
        "normalized_value_snapshot" = o."normalized_value"
      FROM ${schema}."survey_questions" q
      JOIN ${schema}."question_options" o ON o."question_id" = q."question_id"
      WHERE ${schema}."patient_assessment_details"."question_id" = q."question_id"
        AND ${schema}."patient_assessment_details"."selected_option_id" = o."option_id"
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_patient_assessments_case_pod_time"
      ON ${schema}."patient_assessments" ("case_id", "pod_context", "evaluation_datetime" DESC)
    `);

    // ── Scheduled assessment task source of truth ───────────────────────────────
    await queryRunner.query(`
      CREATE TABLE ${schema}."assessment_tasks" (
        "assessment_task_id" SERIAL NOT NULL,
        "case_id" character varying NOT NULL,
        "pod_context" integer NOT NULL,
        "scheduled_slot" character varying(20) NOT NULL,
        "opens_at" TIMESTAMP WITH TIME ZONE NOT NULL,
        "closes_at" TIMESTAMP WITH TIME ZONE NOT NULL,
        "status" character varying(20) NOT NULL DEFAULT 'PENDING',
        "assessment_id" integer UNIQUE,
        "completed_at" TIMESTAMP WITH TIME ZONE,
        "missed_at" TIMESTAMP WITH TIME ZONE,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_assessment_tasks_assessment_task_id" PRIMARY KEY ("assessment_task_id"),
        CONSTRAINT "UQ_assessment_tasks_case_pod_slot" UNIQUE ("case_id", "pod_context", "scheduled_slot"),
        CONSTRAINT "CHK_assessment_tasks_slot"
          CHECK ("scheduled_slot" IN ('MORNING', 'AFTERNOON')),
        CONSTRAINT "CHK_assessment_tasks_status"
          CHECK ("status" IN ('PENDING', 'COMPLETED', 'MISSED')),
        CONSTRAINT "CHK_assessment_tasks_window"
          CHECK ("opens_at" < "closes_at")
      )
    `);

    await queryRunner.query(`
      ALTER TABLE ${schema}."assessment_tasks"
      ADD CONSTRAINT "FK_assessment_tasks_case"
      FOREIGN KEY ("case_id") REFERENCES ${schema}."patient_cases"("case_id")
      ON DELETE CASCADE ON UPDATE NO ACTION NOT VALID,
      ADD CONSTRAINT "FK_assessment_tasks_assessment"
      FOREIGN KEY ("assessment_id") REFERENCES ${schema}."patient_assessments"("assessment_id")
      ON DELETE SET NULL ON UPDATE NO ACTION NOT VALID
    `);

    await queryRunner.query(`
      ALTER TABLE ${schema}."assessment_tasks"
      VALIDATE CONSTRAINT "FK_assessment_tasks_case"
    `);

    await queryRunner.query(`
      ALTER TABLE ${schema}."assessment_tasks"
      VALIDATE CONSTRAINT "FK_assessment_tasks_assessment"
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_assessment_tasks_pending_window"
      ON ${schema}."assessment_tasks" ("opens_at", "closes_at")
      WHERE "status" = 'PENDING'
    `);

    // ── RED workflow audit ─────────────────────────────────────────────────────
    await queryRunner.query(`
      UPDATE ${schema}."monitoring_alerts"
      SET "status" = CASE "status"
        WHEN 'Pending' THEN 'PENDING_REVIEW'
        WHEN 'Acknowledged' THEN 'HANDLED'
        ELSE "status"
      END
    `);

    await queryRunner.query(`
      ALTER TABLE ${schema}."monitoring_alerts"
      ADD COLUMN "handling_started_at" TIMESTAMP WITH TIME ZONE,
      ADD COLUMN "handled_at" TIMESTAMP WITH TIME ZONE,
      ADD COLUMN "handled_by_user_id" integer,
      ADD COLUMN "trigger_details" JSONB NOT NULL DEFAULT '[]'::jsonb
    `);

    await queryRunner.query(`
      UPDATE ${schema}."monitoring_alerts"
      SET "handling_started_at" = "triggered_at"
      WHERE "handling_started_at" IS NULL
    `);

    await queryRunner.query(`
      UPDATE ${schema}."monitoring_alerts"
      SET "handled_at" = "closed_at"
      WHERE "status" = 'HANDLED' AND "handled_at" IS NULL
    `);

    await queryRunner.query(`
      ALTER TABLE ${schema}."monitoring_alerts"
      ADD CONSTRAINT "FK_monitoring_alerts_handled_by"
      FOREIGN KEY ("handled_by_user_id") REFERENCES ${schema}."users"("user_id")
      ON DELETE SET NULL ON UPDATE NO ACTION NOT VALID
    `);

    await queryRunner.query(`
      ALTER TABLE ${schema}."monitoring_alerts"
      VALIDATE CONSTRAINT "FK_monitoring_alerts_handled_by"
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_monitoring_alerts_pending_red_case"
      ON ${schema}."monitoring_alerts" ("case_id", "triggered_at" DESC)
      WHERE "alert_type" = 'RED' AND "status" = 'PENDING_REVIEW'
    `);

    // ── Nutrition and education CMS ────────────────────────────────────────────
    await queryRunner.query(`
      ALTER TABLE ${schema}."pod_protocols"
      ADD COLUMN "forbidden_foods" TEXT[] NOT NULL DEFAULT '{}',
      ADD COLUMN "forbidden_drinks" TEXT[] NOT NULL DEFAULT '{}',
      ADD COLUMN "upgrade_criteria" TEXT[] NOT NULL DEFAULT '{}'
    `);

    await queryRunner.query(`
      CREATE TABLE ${schema}."health_education_pod_contents" (
        "content_id" SERIAL NOT NULL,
        "pod_day" smallint NOT NULL,
        "operation_type_id" integer,
        "goals" JSONB NOT NULL DEFAULT '[]'::jsonb,
        "actions" JSONB NOT NULL DEFAULT '[]'::jsonb,
        "warning_signs" JSONB NOT NULL DEFAULT '[]'::jsonb,
        "note" TEXT,
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_health_education_pod_contents_content_id" PRIMARY KEY ("content_id")
      )
    `);

    await queryRunner.query(`
      ALTER TABLE ${schema}."health_education_pod_contents"
      ADD CONSTRAINT "FK_health_education_pod_contents_operation_type"
      FOREIGN KEY ("operation_type_id") REFERENCES ${schema}."operation_types"("operation_type_id")
      ON DELETE RESTRICT ON UPDATE NO ACTION NOT VALID
    `);

    await queryRunner.query(`
      ALTER TABLE ${schema}."health_education_pod_contents"
      VALIDATE CONSTRAINT "FK_health_education_pod_contents_operation_type"
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_health_education_pod_contents_active"
      ON ${schema}."health_education_pod_contents" ("pod_day", "operation_type_id")
      WHERE "is_active" = true
    `);

    // ── Room-code to nurse assignments ─────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE ${schema}."room_nurse_assignments" (
        "room_code" character varying(50) NOT NULL,
        "nurse_user_id" integer NOT NULL,
        "assigned_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_room_nurse_assignments" PRIMARY KEY ("room_code", "nurse_user_id")
      )
    `);

    await queryRunner.query(`
      ALTER TABLE ${schema}."room_nurse_assignments"
      ADD CONSTRAINT "FK_room_nurse_assignments_nurse"
      FOREIGN KEY ("nurse_user_id") REFERENCES ${schema}."users"("user_id")
      ON DELETE CASCADE ON UPDATE NO ACTION NOT VALID
    `);

    await queryRunner.query(`
      ALTER TABLE ${schema}."room_nurse_assignments"
      VALIDATE CONSTRAINT "FK_room_nurse_assignments_nurse"
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_room_nurse_assignments_nurse"
      ON ${schema}."room_nurse_assignments" ("nurse_user_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const schemaName = process.env.DB_SCHEMA ?? 'public';
    const schema = `"${schemaName}"`;

    await queryRunner.query(`DROP INDEX IF EXISTS ${schema}."IDX_room_nurse_assignments_nurse"`);
    await queryRunner.query(`ALTER TABLE ${schema}."room_nurse_assignments" DROP CONSTRAINT IF EXISTS "FK_room_nurse_assignments_nurse"`);
    await queryRunner.query(`DROP TABLE IF EXISTS ${schema}."room_nurse_assignments"`);

    await queryRunner.query(`DROP INDEX IF EXISTS ${schema}."UQ_health_education_pod_contents_active"`);
    await queryRunner.query(`ALTER TABLE ${schema}."health_education_pod_contents" DROP CONSTRAINT IF EXISTS "FK_health_education_pod_contents_operation_type"`);
    await queryRunner.query(`DROP TABLE IF EXISTS ${schema}."health_education_pod_contents"`);
    await queryRunner.query(`ALTER TABLE ${schema}."pod_protocols" DROP COLUMN IF EXISTS "upgrade_criteria", DROP COLUMN IF EXISTS "forbidden_drinks", DROP COLUMN IF EXISTS "forbidden_foods"`);

    await queryRunner.query(`DROP INDEX IF EXISTS ${schema}."IDX_monitoring_alerts_pending_red_case"`);
    await queryRunner.query(`ALTER TABLE ${schema}."monitoring_alerts" DROP CONSTRAINT IF EXISTS "FK_monitoring_alerts_handled_by"`);
    await queryRunner.query(`ALTER TABLE ${schema}."monitoring_alerts" DROP COLUMN IF EXISTS "trigger_details", DROP COLUMN IF EXISTS "handled_by_user_id", DROP COLUMN IF EXISTS "handled_at", DROP COLUMN IF EXISTS "handling_started_at"`);
    await queryRunner.query(`UPDATE ${schema}."monitoring_alerts" SET "status" = CASE "status" WHEN 'PENDING_REVIEW' THEN 'Pending' WHEN 'HANDLED' THEN 'Acknowledged' ELSE "status" END`);

    await queryRunner.query(`DROP INDEX IF EXISTS ${schema}."IDX_assessment_tasks_pending_window"`);
    await queryRunner.query(`ALTER TABLE ${schema}."assessment_tasks" DROP CONSTRAINT IF EXISTS "FK_assessment_tasks_assessment"`);
    await queryRunner.query(`ALTER TABLE ${schema}."assessment_tasks" DROP CONSTRAINT IF EXISTS "FK_assessment_tasks_case"`);
    await queryRunner.query(`DROP TABLE IF EXISTS ${schema}."assessment_tasks"`);

    await queryRunner.query(`DROP INDEX IF EXISTS ${schema}."IDX_patient_assessments_case_pod_time"`);
    await queryRunner.query(`ALTER TABLE ${schema}."patient_assessment_details" DROP COLUMN IF EXISTS "matched_alert_rule_ids", DROP COLUMN IF EXISTS "normalized_value_snapshot", DROP COLUMN IF EXISTS "option_triage_level_snapshot", DROP COLUMN IF EXISTS "clinical_dimension_snapshot", DROP COLUMN IF EXISTS "option_text_snapshot", DROP COLUMN IF EXISTS "question_text_snapshot"`);
    await queryRunner.query(`ALTER TABLE ${schema}."patient_assessments" DROP CONSTRAINT IF EXISTS "CHK_patient_assessments_scheduled_slot"`);
    await queryRunner.query(`ALTER TABLE ${schema}."patient_assessments" DROP CONSTRAINT IF EXISTS "CHK_patient_assessments_type"`);
    await queryRunner.query(`ALTER TABLE ${schema}."patient_assessments" DROP CONSTRAINT IF EXISTS "FK_patient_assessments_questionnaire_version"`);
    await queryRunner.query(`ALTER TABLE ${schema}."patient_assessments" DROP COLUMN IF EXISTS "triage_triggers", DROP COLUMN IF EXISTS "questionnaire_version_id", DROP COLUMN IF EXISTS "scheduled_slot", DROP COLUMN IF EXISTS "assessment_type"`);

    await queryRunner.query(`ALTER TABLE ${schema}."question_options" DROP CONSTRAINT IF EXISTS "CHK_question_options_triage_level"`);
    await queryRunner.query(`ALTER TABLE ${schema}."question_options" DROP COLUMN IF EXISTS "normalized_value", DROP COLUMN IF EXISTS "option_definition", DROP COLUMN IF EXISTS "option_triage_level"`);
    await queryRunner.query(`DROP INDEX IF EXISTS ${schema}."UQ_survey_questions_version_dimension"`);
    await queryRunner.query(`ALTER TABLE ${schema}."survey_questions" DROP CONSTRAINT IF EXISTS "FK_survey_questions_questionnaire_version"`);
    await queryRunner.query(`ALTER TABLE ${schema}."survey_questions" DROP COLUMN IF EXISTS "clinical_dimension", DROP COLUMN IF EXISTS "questionnaire_version_id"`);
    await queryRunner.query(`DROP INDEX IF EXISTS ${schema}."UQ_questionnaire_versions_one_active"`);
    await queryRunner.query(`DROP TABLE IF EXISTS ${schema}."questionnaire_versions"`);
  }
}
