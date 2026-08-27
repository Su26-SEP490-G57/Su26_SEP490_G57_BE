import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateCoreSchema1780912799000 implements MigrationInterface {
  name = 'CreateCoreSchema1780912799000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const schemaName = process.env.DB_SCHEMA ?? 'public';
    const schema = `"${schemaName}"`;

    await queryRunner.query(`CREATE SCHEMA IF NOT EXISTS ${schema}`);

    // ── Enums ──────────────────────────────────────────────────────────────────

    await queryRunner.query(`CREATE TYPE ${schema}."shift_assignments_shift_type_enum" AS ENUM ('Day', 'Night')`);

    await queryRunner.query(`CREATE TYPE ${schema}."pod_tracking_logs_action_type_enum" AS ENUM ('System_Auto', 'Nurse_Acknowledge', 'Nurse_Pause', 'Nurse_Rollback', 'Nurse_Resume', 'Manual_Close')`);

    await queryRunner.query(`CREATE TYPE ${schema}."alerts_alert_type_enum" AS ENUM ('YELLOW', 'RED')`);

    // ── Standalone / root tables ───────────────────────────────────────────────

    await queryRunner.query(`
      CREATE TABLE ${schema}."users" (
        "user_id"        SERIAL                        NOT NULL,
        "username"       character varying(255)        NOT NULL,
        "password_hash"  character varying(255)        NOT NULL,
        "full_name"      character varying(100)        NOT NULL,
        "phone_number"   character varying(20),
        "is_active"      BOOLEAN                       NOT NULL DEFAULT TRUE,
        "created_at"     TIMESTAMP                     NOT NULL DEFAULT now(),
        "updated_at"     TIMESTAMP                     NOT NULL DEFAULT now(),
        CONSTRAINT "PK_users_user_id"    PRIMARY KEY ("user_id"),
        CONSTRAINT "UQ_users_username"   UNIQUE ("username"),
        CONSTRAINT "UQ_users_phone"      UNIQUE ("phone_number")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE ${schema}."roles" (
        "role_id"     SERIAL                   NOT NULL,
        "role_name"   character varying(50)    NOT NULL,
        "description" character varying(255),
        CONSTRAINT "PK_roles_role_id"      PRIMARY KEY ("role_id"),
        CONSTRAINT "UQ_roles_role_name"    UNIQUE ("role_name")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE ${schema}."permissions" (
        "permission_id"   SERIAL                    NOT NULL,
        "permission_code" character varying(100)    NOT NULL,
        "description"     character varying(255),
        CONSTRAINT "PK_permissions_permission_id"       PRIMARY KEY ("permission_id"),
        CONSTRAINT "UQ_permissions_permission_code"     UNIQUE ("permission_code")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE ${schema}."survey_questions" (
        "question_id"   SERIAL                  NOT NULL,
        "question_text" TEXT                    NOT NULL,
        "order_number"  integer,
        CONSTRAINT "PK_survey_questions_question_id" PRIMARY KEY ("question_id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE ${schema}."question_options" (
        "option_id"    SERIAL                   NOT NULL,
        "question_id"  integer                  NOT NULL,
        "option_text"  character varying(255)   NOT NULL,
        "score_value"  integer                  NOT NULL,
        CONSTRAINT "PK_question_options_option_id" PRIMARY KEY ("option_id")
      )
    `);

    // ── RBAC join tables ───────────────────────────────────────────────────────

    await queryRunner.query(`
      CREATE TABLE ${schema}."user_roles" (
        "user_id" integer NOT NULL,
        "role_id" integer NOT NULL,
        CONSTRAINT "PK_user_roles" PRIMARY KEY ("user_id", "role_id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE ${schema}."role_permissions" (
        "role_id"       integer NOT NULL,
        "permission_id" integer NOT NULL,
        CONSTRAINT "PK_role_permissions" PRIMARY KEY ("role_id", "permission_id")
      )
    `);

    // ── Auth ───────────────────────────────────────────────────────────────────

    await queryRunner.query(`
      CREATE TABLE ${schema}."refresh_tokens" (
        "token_id"   SERIAL                     NOT NULL,
        "user_id"    integer                    NOT NULL,
        "token"      character varying(500)     NOT NULL,
        "expires_at" TIMESTAMP                  NOT NULL,
        CONSTRAINT "PK_refresh_tokens_token_id" PRIMARY KEY ("token_id"),
        CONSTRAINT "UQ_refresh_tokens_token"    UNIQUE ("token")
      )
    `);

    // ── Core clinical tables ───────────────────────────────────────────────────

    await queryRunner.query(`
      CREATE TABLE ${schema}."patient_cases" (
        "case_id"                character varying        NOT NULL,
        "name_initials"          character varying(50),
        "age"                    integer,
        "gender"                 character varying(10),
        "height"                 FLOAT,
        "weight"                 FLOAT,
        "bmi"                    FLOAT,
        "diagnosis"              TEXT,
        "operation_type"         character varying(100),
        "method"                 character varying(100),
        "has_gi_anastomosis"     BOOLEAN,
        "surgery_date"           DATE,
        "room_bed"               character varying(50),
        "current_pod"            integer,
        "assigned_nurse_id"      integer,
        "time_to_redrink"        integer,
        "time_to_reeat"          integer,
        "pod_soft_diet_reached"  integer,
        "time_to_flatus"         integer,
        "time_to_defecation"     integer,
        "gi_complications"       TEXT,
        "length_of_stay"         integer,
        "protocol_final_status"  character varying(50),
        CONSTRAINT "PK_patient_cases_case_id" PRIMARY KEY ("case_id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE ${schema}."shift_assignments" (
        "assignment_id" SERIAL                                          NOT NULL,
        "user_id"       integer                                         NOT NULL,
        "shift_date"    DATE                                            NOT NULL,
        "shift_type"    ${schema}."shift_assignments_shift_type_enum"   NOT NULL,
        "created_at"    TIMESTAMP                                       NOT NULL DEFAULT now(),
        CONSTRAINT "PK_shift_assignments_assignment_id" PRIMARY KEY ("assignment_id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE ${schema}."patient_assessments" (
        "assessment_id"       SERIAL                    NOT NULL,
        "case_id"             character varying         NOT NULL,
        "evaluation_datetime" TIMESTAMP                 NOT NULL,
        "pod_context"         integer,
        "shift_period"        character varying(20),
        "total_score"         integer                   NOT NULL DEFAULT 0,
        "triage_color"        character varying(20),
        CONSTRAINT "PK_patient_assessments_assessment_id" PRIMARY KEY ("assessment_id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE ${schema}."patient_assessment_details" (
        "detail_id"          SERIAL            NOT NULL,
        "assessment_id"      integer           NOT NULL,
        "question_id"        integer           NOT NULL,
        "selected_option_id" integer           NOT NULL,
        "score_earned"       integer           NOT NULL,
        CONSTRAINT "PK_patient_assessment_details_detail_id" PRIMARY KEY ("detail_id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE ${schema}."pod_protocol_tracking_logs" (
        "log_id"      SERIAL                                              NOT NULL,
        "case_id"     character varying                                   NOT NULL,
        "pod_number"  integer,
        "old_status"  character varying(50)                               NOT NULL,
        "new_status"  character varying(50)                               NOT NULL,
        "action_type" ${schema}."pod_tracking_logs_action_type_enum"      NOT NULL,
        "changed_by"  integer,
        "hold_reason" TEXT,
        "changed_at"  TIMESTAMP                                           NOT NULL DEFAULT now(),
        CONSTRAINT "PK_pod_protocol_tracking_logs_log_id" PRIMARY KEY ("log_id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE ${schema}."app_engagement_logs" (
        "log_id"                 SERIAL              NOT NULL,
        "case_id"                character varying   NOT NULL,
        "viewed_guidance"        BOOLEAN,
        "viewed_education"       BOOLEAN,
        "app_access_count"       integer,
        "reminder_count"         integer,
        "call_nurse_clicks"      integer,
        "survey_completion_rate" FLOAT,
        CONSTRAINT "PK_app_engagement_logs_log_id" PRIMARY KEY ("log_id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE ${schema}."monitoring_alerts" (
        "alert_id"            SERIAL                                  NOT NULL,
        "case_id"             character varying                       NOT NULL,
        "assessment_id"       integer                                 NOT NULL,
        "survey_score"        integer,
        "alert_type"          ${schema}."alerts_alert_type_enum"      NOT NULL,
        "status"              character varying(50)                   NOT NULL DEFAULT 'Pending',
        "is_auto_progression"  BOOLEAN,
        "triggered_at"        TIMESTAMP,
        "assigned_nurse_id"   integer,
        "acknowledged_at"     TIMESTAMP,
        "nurse_action"        character varying(100),
        "is_doctor_notified"  BOOLEAN,
        "nursing_note"        TEXT,
        "closed_at"           TIMESTAMP,
        CONSTRAINT "PK_monitoring_alerts_alert_id" PRIMARY KEY ("alert_id")
      )
    `);


    // ── Seed: Module B survey questions/options ───────────────────────────────

    await queryRunner.query(`
      INSERT INTO ${schema}."survey_questions" ("question_text", "order_number")
      VALUES
        ('Trong khoảng thời gian từ lần đánh giá trước đến hiện tại, bạn có cảm thấy buồn nôn không?', 1),
        ('Trong khoảng thời gian từ lần đánh giá trước đến hiện tại, bạn có bị nôn không?', 2),
        ('Bạn có cảm giác chướng bụng không?', 3),
        ('Trong bữa ăn gần nhất, bạn đã ăn được khoảng bao nhiêu khẩu phần được cung cấp?', 4),
        ('Kể từ lần đánh giá trước đến hiện tại, bạn đã trung tiện chưa?', 5)
    `);

    await queryRunner.query(`
      INSERT INTO ${schema}."question_options" ("question_id", "option_text", "score_value")
      SELECT q."question_id", v."option_text", v."score_value"
      FROM ${schema}."survey_questions" q
      JOIN (
        VALUES
          (1, 'Không', 0),
          (1, 'Có nhưng vẫn ăn uống được', 1),
          (1, 'Buồn nôn nhiều, phải ngừng ăn hoặc rất khó ăn', 2),
          (2, 'Không', 0),
          (2, 'Có 1 lần', 2),
          (2, 'Có từ 2 lần trở lên', 3),
          (3, 'Không', 0),
          (3, 'Có nhưng vẫn sinh hoạt và ăn uống được', 1),
          (3, 'Chướng nhiều, khó chịu hoặc phải ngừng ăn', 2),
          (4, 'Ăn được ≥75% khẩu phần', 0),
          (4, 'Ăn được từ 50% đến dưới 75% khẩu phần', 1),
          (4, 'Ăn được <50% khẩu phần hoặc không ăn được', 2),
          (5, 'Đã trung tiện', 0),
          (5, 'Chưa trung tiện', 1)
      ) AS v("order_number", "option_text", "score_value")
        ON q."order_number" = v."order_number"
    `);

    // ── Foreign keys ───────────────────────────────────────────────────────────

    // user_roles
    await queryRunner.query(`
      ALTER TABLE ${schema}."user_roles"
      ADD CONSTRAINT "FK_user_roles_user_id"
      FOREIGN KEY ("user_id") REFERENCES ${schema}."users"("user_id") ON DELETE CASCADE ON UPDATE NO ACTION
    `);
    await queryRunner.query(`
      ALTER TABLE ${schema}."user_roles"
      ADD CONSTRAINT "FK_user_roles_role_id"
      FOREIGN KEY ("role_id") REFERENCES ${schema}."roles"("role_id") ON DELETE CASCADE ON UPDATE NO ACTION
    `);

    // role_permissions
    await queryRunner.query(`
      ALTER TABLE ${schema}."role_permissions"
      ADD CONSTRAINT "FK_role_permissions_role_id"
      FOREIGN KEY ("role_id") REFERENCES ${schema}."roles"("role_id") ON DELETE CASCADE ON UPDATE NO ACTION
    `);
    await queryRunner.query(`
      ALTER TABLE ${schema}."role_permissions"
      ADD CONSTRAINT "FK_role_permissions_permission_id"
      FOREIGN KEY ("permission_id") REFERENCES ${schema}."permissions"("permission_id") ON DELETE CASCADE ON UPDATE NO ACTION
    `);

    // refresh_tokens
    await queryRunner.query(`
      ALTER TABLE ${schema}."refresh_tokens"
      ADD CONSTRAINT "FK_refresh_tokens_user_id"
      FOREIGN KEY ("user_id") REFERENCES ${schema}."users"("user_id") ON DELETE CASCADE ON UPDATE NO ACTION
    `);

    // patient_cases
    await queryRunner.query(`
      ALTER TABLE ${schema}."patient_cases"
      ADD CONSTRAINT "FK_patient_cases_assigned_nurse_id"
      FOREIGN KEY ("assigned_nurse_id") REFERENCES ${schema}."users"("user_id") ON DELETE SET NULL ON UPDATE NO ACTION
    `);

    // shift_assignments
    await queryRunner.query(`
      ALTER TABLE ${schema}."shift_assignments"
      ADD CONSTRAINT "FK_shift_assignments_user_id"
      FOREIGN KEY ("user_id") REFERENCES ${schema}."users"("user_id") ON DELETE CASCADE ON UPDATE NO ACTION
    `);

    // survey questions/options
    await queryRunner.query(`
      ALTER TABLE ${schema}."question_options"
      ADD CONSTRAINT "FK_question_options_question_id"
      FOREIGN KEY ("question_id") REFERENCES ${schema}."survey_questions"("question_id") ON DELETE CASCADE ON UPDATE NO ACTION
    `);

    // patient_assessments
    await queryRunner.query(`
      ALTER TABLE ${schema}."patient_assessments"
      ADD CONSTRAINT "FK_patient_assessments_case_id"
      FOREIGN KEY ("case_id") REFERENCES ${schema}."patient_cases"("case_id") ON DELETE CASCADE ON UPDATE NO ACTION
    `);

    // patient_assessment_details
    await queryRunner.query(`
      ALTER TABLE ${schema}."patient_assessment_details"
      ADD CONSTRAINT "FK_patient_assessment_details_assessment_id"
      FOREIGN KEY ("assessment_id") REFERENCES ${schema}."patient_assessments"("assessment_id") ON DELETE CASCADE ON UPDATE NO ACTION
    `);
    await queryRunner.query(`
      ALTER TABLE ${schema}."patient_assessment_details"
      ADD CONSTRAINT "FK_patient_assessment_details_question_id"
      FOREIGN KEY ("question_id") REFERENCES ${schema}."survey_questions"("question_id") ON DELETE RESTRICT ON UPDATE NO ACTION
    `);
    await queryRunner.query(`
      ALTER TABLE ${schema}."patient_assessment_details"
      ADD CONSTRAINT "FK_patient_assessment_details_selected_option_id"
      FOREIGN KEY ("selected_option_id") REFERENCES ${schema}."question_options"("option_id") ON DELETE RESTRICT ON UPDATE NO ACTION
    `);

    // pod_protocol_tracking_logs
    await queryRunner.query(`
      ALTER TABLE ${schema}."pod_protocol_tracking_logs"
      ADD CONSTRAINT "FK_pod_tracking_logs_case_id"
      FOREIGN KEY ("case_id") REFERENCES ${schema}."patient_cases"("case_id") ON DELETE CASCADE ON UPDATE NO ACTION
    `);
    await queryRunner.query(`
      ALTER TABLE ${schema}."pod_protocol_tracking_logs"
      ADD CONSTRAINT "FK_pod_tracking_logs_changed_by"
      FOREIGN KEY ("changed_by") REFERENCES ${schema}."users"("user_id") ON DELETE SET NULL ON UPDATE NO ACTION
    `);

    // app_engagement_logs
    await queryRunner.query(`
      ALTER TABLE ${schema}."app_engagement_logs"
      ADD CONSTRAINT "FK_app_engagement_logs_case_id"
      FOREIGN KEY ("case_id") REFERENCES ${schema}."patient_cases"("case_id") ON DELETE CASCADE ON UPDATE NO ACTION
    `);

    // monitoring_alerts
    await queryRunner.query(`
      ALTER TABLE ${schema}."monitoring_alerts"
      ADD CONSTRAINT "FK_monitoring_alerts_case_id"
      FOREIGN KEY ("case_id") REFERENCES ${schema}."patient_cases"("case_id") ON DELETE CASCADE ON UPDATE NO ACTION
    `);
    await queryRunner.query(`
      ALTER TABLE ${schema}."monitoring_alerts"
      ADD CONSTRAINT "FK_monitoring_alerts_assessment_id"
      FOREIGN KEY ("assessment_id") REFERENCES ${schema}."patient_assessments"("assessment_id") ON DELETE CASCADE ON UPDATE NO ACTION
    `);
    await queryRunner.query(`
      ALTER TABLE ${schema}."monitoring_alerts"
      ADD CONSTRAINT "FK_monitoring_alerts_assigned_nurse_id"
      FOREIGN KEY ("assigned_nurse_id") REFERENCES ${schema}."users"("user_id") ON DELETE SET NULL ON UPDATE NO ACTION
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const schemaName = process.env.DB_SCHEMA ?? 'public';
    const schema = `"${schemaName}"`;

    // Drop FKs
    await queryRunner.query(`ALTER TABLE ${schema}."monitoring_alerts"           DROP CONSTRAINT IF EXISTS "FK_monitoring_alerts_assigned_nurse_id"`);
    await queryRunner.query(`ALTER TABLE ${schema}."monitoring_alerts"           DROP CONSTRAINT IF EXISTS "FK_monitoring_alerts_assessment_id"`);
    await queryRunner.query(`ALTER TABLE ${schema}."monitoring_alerts"           DROP CONSTRAINT IF EXISTS "FK_monitoring_alerts_case_id"`);
    await queryRunner.query(`ALTER TABLE ${schema}."app_engagement_logs"         DROP CONSTRAINT IF EXISTS "FK_app_engagement_logs_case_id"`);
    await queryRunner.query(`ALTER TABLE ${schema}."pod_protocol_tracking_logs"  DROP CONSTRAINT IF EXISTS "FK_pod_tracking_logs_changed_by"`);
    await queryRunner.query(`ALTER TABLE ${schema}."pod_protocol_tracking_logs"  DROP CONSTRAINT IF EXISTS "FK_pod_tracking_logs_case_id"`);
    await queryRunner.query(`ALTER TABLE ${schema}."patient_assessment_details"  DROP CONSTRAINT IF EXISTS "FK_patient_assessment_details_selected_option_id"`);
    await queryRunner.query(`ALTER TABLE ${schema}."patient_assessment_details"  DROP CONSTRAINT IF EXISTS "FK_patient_assessment_details_question_id"`);
    await queryRunner.query(`ALTER TABLE ${schema}."patient_assessment_details"  DROP CONSTRAINT IF EXISTS "FK_patient_assessment_details_assessment_id"`);
    await queryRunner.query(`ALTER TABLE ${schema}."patient_assessments"         DROP CONSTRAINT IF EXISTS "FK_patient_assessments_case_id"`);
    await queryRunner.query(`ALTER TABLE ${schema}."question_options"            DROP CONSTRAINT IF EXISTS "FK_question_options_question_id"`);
    await queryRunner.query(`ALTER TABLE ${schema}."shift_assignments"           DROP CONSTRAINT IF EXISTS "FK_shift_assignments_user_id"`);
    await queryRunner.query(`ALTER TABLE ${schema}."patient_cases"               DROP CONSTRAINT IF EXISTS "FK_patient_cases_assigned_nurse_id"`);
    await queryRunner.query(`ALTER TABLE ${schema}."refresh_tokens"              DROP CONSTRAINT IF EXISTS "FK_refresh_tokens_user_id"`);
    await queryRunner.query(`ALTER TABLE ${schema}."role_permissions"            DROP CONSTRAINT IF EXISTS "FK_role_permissions_permission_id"`);
    await queryRunner.query(`ALTER TABLE ${schema}."role_permissions"            DROP CONSTRAINT IF EXISTS "FK_role_permissions_role_id"`);
    await queryRunner.query(`ALTER TABLE ${schema}."user_roles"                  DROP CONSTRAINT IF EXISTS "FK_user_roles_role_id"`);
    await queryRunner.query(`ALTER TABLE ${schema}."user_roles"                  DROP CONSTRAINT IF EXISTS "FK_user_roles_user_id"`);

    // Drop tables (dependents first)
    await queryRunner.query(`DROP TABLE IF EXISTS ${schema}."monitoring_alerts"`);
    await queryRunner.query(`DROP TABLE IF EXISTS ${schema}."app_engagement_logs"`);
    await queryRunner.query(`DROP TABLE IF EXISTS ${schema}."pod_protocol_tracking_logs"`);
    await queryRunner.query(`DROP TABLE IF EXISTS ${schema}."patient_assessment_details"`);
    await queryRunner.query(`DROP TABLE IF EXISTS ${schema}."patient_assessments"`);
    await queryRunner.query(`DROP TABLE IF EXISTS ${schema}."question_options"`);
    await queryRunner.query(`DROP TABLE IF EXISTS ${schema}."survey_questions"`);
    await queryRunner.query(`DROP TABLE IF EXISTS ${schema}."shift_assignments"`);
    await queryRunner.query(`DROP TABLE IF EXISTS ${schema}."patient_cases"`);
    await queryRunner.query(`DROP TABLE IF EXISTS ${schema}."refresh_tokens"`);
    await queryRunner.query(`DROP TABLE IF EXISTS ${schema}."role_permissions"`);
    await queryRunner.query(`DROP TABLE IF EXISTS ${schema}."user_roles"`);
    await queryRunner.query(`DROP TABLE IF EXISTS ${schema}."permissions"`);
    await queryRunner.query(`DROP TABLE IF EXISTS ${schema}."roles"`);
    await queryRunner.query(`DROP TABLE IF EXISTS ${schema}."users"`);

    // Drop enums
    await queryRunner.query(`DROP TYPE IF EXISTS ${schema}."alerts_alert_type_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS ${schema}."pod_tracking_logs_action_type_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS ${schema}."shift_assignments_shift_type_enum"`);
  }
}
