import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateCoreSchema20260528000100 implements MigrationInterface {
  name = 'CreateCoreSchema20260528000100';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const schemaName = process.env.DB_SCHEMA ?? 'public';
    const schema = `"${schemaName}"`;

    await queryRunner.query(`CREATE SCHEMA IF NOT EXISTS ${schema}`);

    await queryRunner.query(`CREATE TYPE ${schema}."users_role_enum" AS ENUM ('Admin', 'Head_Nurse', 'Nurse')`);
    await queryRunner.query(`CREATE TYPE ${schema}."users_status_enum" AS ENUM ('Active', 'Inactive')`);
    await queryRunner.query(`CREATE TYPE ${schema}."patients_gender_enum" AS ENUM ('Nam', 'Nữ')`);
    await queryRunner.query(`CREATE TYPE ${schema}."patients_asa_classification_enum" AS ENUM ('I', 'II', 'III', 'IV')`);
    await queryRunner.query(`CREATE TYPE ${schema}."patients_surgery_type_enum" AS ENUM ('Dạ dày', 'Đại tràng', 'Trực tràng')`);
    await queryRunner.query(`CREATE TYPE ${schema}."patients_surgery_method_enum" AS ENUM ('Nội soi', 'Mổ mở')`);
    await queryRunner.query(`CREATE TYPE ${schema}."patients_pod_status_enum" AS ENUM ('Active', 'Paused', 'Rolled_Back', 'Completed')`);
    await queryRunner.query(`CREATE TYPE ${schema}."shift_assignments_shift_type_enum" AS ENUM ('Day', 'Night')`);
    await queryRunner.query(`CREATE TYPE ${schema}."pod_tracking_logs_old_status_enum" AS ENUM ('Active', 'Paused', 'Rolled_Back', 'Completed')`);
    await queryRunner.query(`CREATE TYPE ${schema}."pod_tracking_logs_new_status_enum" AS ENUM ('Active', 'Paused', 'Rolled_Back', 'Completed')`);
    await queryRunner.query(`CREATE TYPE ${schema}."pod_tracking_logs_action_type_enum" AS ENUM ('System_Auto', 'Nurse_Acknowledge', 'Nurse_Pause', 'Nurse_Rollback', 'Nurse_Resume', 'Manual_Close')`);
    await queryRunner.query(`CREATE TYPE ${schema}."symptom_surveys_triage_status_enum" AS ENUM ('GREEN', 'YELLOW', 'RED')`);
    await queryRunner.query(`CREATE TYPE ${schema}."alerts_alert_level_enum" AS ENUM ('YELLOW', 'RED')`);
    await queryRunner.query(`CREATE TYPE ${schema}."alerts_status_enum" AS ENUM ('Pending', 'Acknowledged', 'Paused_POD', 'Rolled_Back', 'Escalated', 'Closed')`);

    await queryRunner.query(`
      CREATE TABLE ${schema}."users" (
        "user_id" SERIAL NOT NULL,
        "username" character varying(50) NOT NULL,
        "password_hash" character varying(255) NOT NULL,
        "full_name" character varying(100) NOT NULL,
        "role" ${schema}."users_role_enum" NOT NULL DEFAULT 'Nurse',
        "status" ${schema}."users_status_enum" NOT NULL DEFAULT 'Active',
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_users_user_id" PRIMARY KEY ("user_id"),
        CONSTRAINT "UQ_users_username" UNIQUE ("username")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE ${schema}."patients" (
        "patient_id" character varying(50) NOT NULL,
        "full_name" character varying(100) NOT NULL,
        "age" integer NOT NULL,
        "gender" ${schema}."patients_gender_enum" NOT NULL,
        "bmi" numeric(4,2),
        "occupation" character varying(100),
        "underlying_diseases" text,
        "asa_classification" ${schema}."patients_asa_classification_enum",
        "surgery_type" ${schema}."patients_surgery_type_enum",
        "surgery_method" ${schema}."patients_surgery_method_enum",
        "surgery_date" date,
        "room_id" integer,
        "has_zalo" boolean NOT NULL DEFAULT false,
        "has_smartphone" boolean NOT NULL DEFAULT false,
        "has_caregiver_support" boolean NOT NULL DEFAULT false,
        "current_pod" integer,
        "pod_status" ${schema}."patients_pod_status_enum",
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_patients_patient_id" PRIMARY KEY ("patient_id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE ${schema}."shift_assignments" (
        "assignment_id" SERIAL NOT NULL,
        "nurse_id" integer NOT NULL,
        "shift_date" date NOT NULL,
        "shift_type" ${schema}."shift_assignments_shift_type_enum" NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_shift_assignments_assignment_id" PRIMARY KEY ("assignment_id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE ${schema}."pod_tracking_logs" (
        "log_id" SERIAL NOT NULL,
        "patient_id" character varying(50) NOT NULL,
        "old_pod" integer,
        "new_pod" integer,
        "old_status" ${schema}."pod_tracking_logs_old_status_enum" NOT NULL,
        "new_status" ${schema}."pod_tracking_logs_new_status_enum" NOT NULL,
        "action_type" ${schema}."pod_tracking_logs_action_type_enum" NOT NULL,
        "changed_by" integer,
        "changed_at" TIMESTAMP NOT NULL DEFAULT now(),
        "notes" text,
        CONSTRAINT "PK_pod_tracking_logs_log_id" PRIMARY KEY ("log_id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE ${schema}."symptom_surveys" (
        "survey_id" SERIAL NOT NULL,
        "patient_id" character varying(50) NOT NULL,
        "pod_day" integer NOT NULL,
        "nausea_score" integer NOT NULL DEFAULT 0,
        "vomiting_score" integer NOT NULL DEFAULT 0,
        "bloating_score" integer NOT NULL DEFAULT 0,
        "intake_score" integer NOT NULL DEFAULT 0,
        "flatus_score" integer NOT NULL DEFAULT 0,
        "total_score" integer NOT NULL DEFAULT 0,
        "triage_status" ${schema}."symptom_surveys_triage_status_enum" NOT NULL,
        "submitted_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_symptom_surveys_survey_id" PRIMARY KEY ("survey_id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE ${schema}."alerts" (
        "alert_id" SERIAL NOT NULL,
        "survey_id" integer NOT NULL,
        "patient_id" character varying(50) NOT NULL,
        "alert_level" ${schema}."alerts_alert_level_enum" NOT NULL,
        "reason" character varying(255) NOT NULL,
        "status" ${schema}."alerts_status_enum" NOT NULL DEFAULT 'Pending',
        "handled_by" integer,
        "handled_at" TIMESTAMP,
        "nurse_notes" text,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_alerts_alert_id" PRIMARY KEY ("alert_id")
      )
    `);

    await queryRunner.query(`
      ALTER TABLE ${schema}."shift_assignments"
      ADD CONSTRAINT "FK_shift_assignments_nurse_id"
      FOREIGN KEY ("nurse_id") REFERENCES ${schema}."users"("user_id") ON DELETE CASCADE ON UPDATE NO ACTION
    `);

    await queryRunner.query(`
      ALTER TABLE ${schema}."pod_tracking_logs"
      ADD CONSTRAINT "FK_pod_tracking_logs_patient_id"
      FOREIGN KEY ("patient_id") REFERENCES ${schema}."patients"("patient_id") ON DELETE CASCADE ON UPDATE NO ACTION
    `);

    await queryRunner.query(`
      ALTER TABLE ${schema}."pod_tracking_logs"
      ADD CONSTRAINT "FK_pod_tracking_logs_changed_by"
      FOREIGN KEY ("changed_by") REFERENCES ${schema}."users"("user_id") ON DELETE SET NULL ON UPDATE NO ACTION
    `);

    await queryRunner.query(`
      ALTER TABLE ${schema}."symptom_surveys"
      ADD CONSTRAINT "FK_symptom_surveys_patient_id"
      FOREIGN KEY ("patient_id") REFERENCES ${schema}."patients"("patient_id") ON DELETE CASCADE ON UPDATE NO ACTION
    `);

    await queryRunner.query(`
      ALTER TABLE ${schema}."alerts"
      ADD CONSTRAINT "FK_alerts_survey_id"
      FOREIGN KEY ("survey_id") REFERENCES ${schema}."symptom_surveys"("survey_id") ON DELETE CASCADE ON UPDATE NO ACTION
    `);

    await queryRunner.query(`
      ALTER TABLE ${schema}."alerts"
      ADD CONSTRAINT "FK_alerts_patient_id"
      FOREIGN KEY ("patient_id") REFERENCES ${schema}."patients"("patient_id") ON DELETE CASCADE ON UPDATE NO ACTION
    `);

    await queryRunner.query(`
      ALTER TABLE ${schema}."alerts"
      ADD CONSTRAINT "FK_alerts_handled_by"
      FOREIGN KEY ("handled_by") REFERENCES ${schema}."users"("user_id") ON DELETE SET NULL ON UPDATE NO ACTION
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const schemaName = process.env.DB_SCHEMA ?? 'public';
    const schema = `"${schemaName}"`;

    await queryRunner.query(`ALTER TABLE ${schema}."alerts" DROP CONSTRAINT IF EXISTS "FK_alerts_handled_by"`);
    await queryRunner.query(`ALTER TABLE ${schema}."alerts" DROP CONSTRAINT IF EXISTS "FK_alerts_patient_id"`);
    await queryRunner.query(`ALTER TABLE ${schema}."alerts" DROP CONSTRAINT IF EXISTS "FK_alerts_survey_id"`);
    await queryRunner.query(`ALTER TABLE ${schema}."symptom_surveys" DROP CONSTRAINT IF EXISTS "FK_symptom_surveys_patient_id"`);
    await queryRunner.query(`ALTER TABLE ${schema}."pod_tracking_logs" DROP CONSTRAINT IF EXISTS "FK_pod_tracking_logs_changed_by"`);
    await queryRunner.query(`ALTER TABLE ${schema}."pod_tracking_logs" DROP CONSTRAINT IF EXISTS "FK_pod_tracking_logs_patient_id"`);
    await queryRunner.query(`ALTER TABLE ${schema}."shift_assignments" DROP CONSTRAINT IF EXISTS "FK_shift_assignments_nurse_id"`);

    await queryRunner.query(`DROP TABLE IF EXISTS ${schema}."alerts"`);
    await queryRunner.query(`DROP TABLE IF EXISTS ${schema}."symptom_surveys"`);
    await queryRunner.query(`DROP TABLE IF EXISTS ${schema}."pod_tracking_logs"`);
    await queryRunner.query(`DROP TABLE IF EXISTS ${schema}."shift_assignments"`);
    await queryRunner.query(`DROP TABLE IF EXISTS ${schema}."patients"`);
    await queryRunner.query(`DROP TABLE IF EXISTS ${schema}."users"`);

    await queryRunner.query(`DROP TYPE IF EXISTS ${schema}."alerts_status_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS ${schema}."alerts_alert_level_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS ${schema}."symptom_surveys_triage_status_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS ${schema}."pod_tracking_logs_action_type_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS ${schema}."pod_tracking_logs_new_status_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS ${schema}."pod_tracking_logs_old_status_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS ${schema}."shift_assignments_shift_type_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS ${schema}."patients_pod_status_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS ${schema}."patients_surgery_method_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS ${schema}."patients_surgery_type_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS ${schema}."patients_asa_classification_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS ${schema}."patients_gender_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS ${schema}."users_status_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS ${schema}."users_role_enum"`);
  }
}