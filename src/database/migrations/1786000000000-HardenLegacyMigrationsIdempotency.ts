/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Consolidates hardening that was previously applied by hand-editing already-run
 * migrations (DropNameInitialsColumn, EnsureLevelsData, RenameColumnCamelCase,
 * CreateUserDevicesTable). Those files have been reverted to their original state;
 * this migration re-applies the same fixes as a forward-only, idempotent step.
 */
export class HardenLegacyMigrationsIdempotency1786000000000 implements MigrationInterface {
  name = 'HardenLegacyMigrationsIdempotency1786000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const schemaName = process.env.DB_SCHEMA ?? 'public';
    const schema = `"${schemaName}"`;

    await queryRunner.query(`SET search_path TO ${schema}, public;`);

    // --- DropNameInitialsColumn hardening: tolerate a missing/renamed table, honor DB_SCHEMA ---
    await queryRunner.query(`
      DO $$
      DECLARE
        s text := '${schemaName}';
      BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = s AND table_name = 'patient_cases') THEN
          EXECUTE format('ALTER TABLE %I."patient_cases" DROP COLUMN IF EXISTS name_initials', s);
        ELSIF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = s AND table_name = 'patients') THEN
          EXECUTE format('ALTER TABLE %I."patients" DROP COLUMN IF EXISTS name_initials', s);
        END IF;
      END $$;
    `);

    // --- EnsureLevelsData hardening: tolerate a missing levels table ---
    if (await queryRunner.hasTable('levels')) {
      const result = await queryRunner.query(`SELECT COUNT(*) as count FROM ${schema}."levels"`);
      const count = parseInt(result[0]?.count || '0', 10);
      if (count === 0) {
        await queryRunner.query(`
          INSERT INTO ${schema}."levels" ("level_name", "description", "sort_order")
          VALUES
            ('Red',    'High risk - immediate attention required', 1),
            ('Yellow', 'Moderate risk - monitor closely',          2),
            ('Green',  'Low risk - stable',                        3)
        `);
      }
    }

    // --- RenameColumnCamelCase hardening: make constraint/index/type churn idempotent ---
    await queryRunner.query(`ALTER TABLE "patient_cases" DROP CONSTRAINT IF EXISTS "FK_26791b2915e60b78955df46a46b"`);
    await queryRunner.query(`ALTER TABLE "patient_cases" ADD CONSTRAINT "FK_26791b2915e60b78955df46a46b" FOREIGN KEY ("operation_type_id") REFERENCES "operation_types"("operation_type_id") ON DELETE SET NULL ON UPDATE NO ACTION NOT VALID`);
    await queryRunner.query(`ALTER TABLE "patient_cases" VALIDATE CONSTRAINT "FK_26791b2915e60b78955df46a46b"`);
    await queryRunner.query(`ALTER TABLE "patient_cases" DROP CONSTRAINT IF EXISTS "FK_564e16562745e58568bff6bbf84"`);
    await queryRunner.query(`ALTER TABLE "patient_cases" ADD CONSTRAINT "FK_564e16562745e58568bff6bbf84" FOREIGN KEY ("assigned_nurse_id") REFERENCES "users"("user_id") ON DELETE SET NULL ON UPDATE NO ACTION NOT VALID`);
    await queryRunner.query(`ALTER TABLE "patient_cases" VALIDATE CONSTRAINT "FK_564e16562745e58568bff6bbf84"`);
    await queryRunner.query(`ALTER TABLE "patient_cases" DROP CONSTRAINT IF EXISTS "FK_1adc6971e2aa283295d56e0278f"`);
    await queryRunner.query(`ALTER TABLE "patient_cases" ADD CONSTRAINT "FK_1adc6971e2aa283295d56e0278f" FOREIGN KEY ("level_id") REFERENCES "levels"("level_id") ON DELETE SET NULL ON UPDATE NO ACTION NOT VALID`);
    await queryRunner.query(`ALTER TABLE "patient_cases" VALIDATE CONSTRAINT "FK_1adc6971e2aa283295d56e0278f"`);
    await queryRunner.query(`ALTER TABLE "question_options" DROP CONSTRAINT IF EXISTS "FK_f0b7aaabd3f88e700daf0fe681c"`);
    await queryRunner.query(`ALTER TABLE "question_options" ADD CONSTRAINT "FK_f0b7aaabd3f88e700daf0fe681c" FOREIGN KEY ("question_id") REFERENCES "survey_questions"("question_id") ON DELETE CASCADE ON UPDATE NO ACTION NOT VALID`);
    await queryRunner.query(`ALTER TABLE "question_options" VALIDATE CONSTRAINT "FK_f0b7aaabd3f88e700daf0fe681c"`);
    await queryRunner.query(`ALTER TABLE "patient_assessment_details" DROP CONSTRAINT IF EXISTS "FK_16a37f6669aab521dea19acddd7"`);
    await queryRunner.query(`ALTER TABLE "patient_assessment_details" ADD CONSTRAINT "FK_16a37f6669aab521dea19acddd7" FOREIGN KEY ("assessment_id") REFERENCES "patient_assessments"("assessment_id") ON DELETE CASCADE ON UPDATE NO ACTION NOT VALID`);
    await queryRunner.query(`ALTER TABLE "patient_assessment_details" VALIDATE CONSTRAINT "FK_16a37f6669aab521dea19acddd7"`);
    await queryRunner.query(`ALTER TABLE "patient_assessment_details" DROP CONSTRAINT IF EXISTS "FK_35a9385c0134f282b7f01521af1"`);
    await queryRunner.query(`ALTER TABLE "patient_assessment_details" ADD CONSTRAINT "FK_35a9385c0134f282b7f01521af1" FOREIGN KEY ("question_id") REFERENCES "survey_questions"("question_id") ON DELETE RESTRICT ON UPDATE NO ACTION NOT VALID`);
    await queryRunner.query(`ALTER TABLE "patient_assessment_details" VALIDATE CONSTRAINT "FK_35a9385c0134f282b7f01521af1"`);
    await queryRunner.query(`ALTER TABLE "patient_assessment_details" DROP CONSTRAINT IF EXISTS "FK_43de77f7c4d3648974da8058bec"`);
    await queryRunner.query(`ALTER TABLE "patient_assessment_details" ADD CONSTRAINT "FK_43de77f7c4d3648974da8058bec" FOREIGN KEY ("selected_option_id") REFERENCES "question_options"("option_id") ON DELETE RESTRICT ON UPDATE NO ACTION NOT VALID`);
    await queryRunner.query(`ALTER TABLE "patient_assessment_details" VALIDATE CONSTRAINT "FK_43de77f7c4d3648974da8058bec"`);
    await queryRunner.query(`ALTER TABLE "patient_assessments" DROP CONSTRAINT IF EXISTS "FK_c1402da90bece37d4445611bffd"`);
    await queryRunner.query(`ALTER TABLE "patient_assessments" ADD CONSTRAINT "FK_c1402da90bece37d4445611bffd" FOREIGN KEY ("case_id") REFERENCES "patient_cases"("case_id") ON DELETE CASCADE ON UPDATE NO ACTION NOT VALID`);
    await queryRunner.query(`ALTER TABLE "patient_assessments" VALIDATE CONSTRAINT "FK_c1402da90bece37d4445611bffd"`);
    await queryRunner.query(`ALTER TABLE "pod_protocols" DROP CONSTRAINT IF EXISTS "FK_d5a013f726d32f46601250c110e"`);
    await queryRunner.query(`ALTER TABLE "pod_protocols" ADD CONSTRAINT "FK_d5a013f726d32f46601250c110e" FOREIGN KEY ("operation_type_id") REFERENCES "operation_types"("operation_type_id") ON DELETE RESTRICT ON UPDATE NO ACTION NOT VALID`);
    await queryRunner.query(`ALTER TABLE "pod_protocols" VALIDATE CONSTRAINT "FK_d5a013f726d32f46601250c110e"`);
    await queryRunner.query(`ALTER TABLE "pod_protocols" DROP CONSTRAINT IF EXISTS "FK_1d8d357da1c265067f5f09d7e0f"`);
    await queryRunner.query(`ALTER TABLE "pod_protocols" ADD CONSTRAINT "FK_1d8d357da1c265067f5f09d7e0f" FOREIGN KEY ("updated_by") REFERENCES "users"("user_id") ON DELETE SET NULL ON UPDATE NO ACTION NOT VALID`);
    await queryRunner.query(`ALTER TABLE "pod_protocols" VALIDATE CONSTRAINT "FK_1d8d357da1c265067f5f09d7e0f"`);
    await queryRunner.query(`ALTER TABLE "refresh_tokens" DROP CONSTRAINT IF EXISTS "FK_3ddc983c5f7bcf132fd8732c3f4"`);
    await queryRunner.query(`ALTER TABLE "refresh_tokens" ADD CONSTRAINT "FK_3ddc983c5f7bcf132fd8732c3f4" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE CASCADE ON UPDATE NO ACTION NOT VALID`);
    await queryRunner.query(`ALTER TABLE "refresh_tokens" VALIDATE CONSTRAINT "FK_3ddc983c5f7bcf132fd8732c3f4"`);
    await queryRunner.query(`ALTER TABLE "monitoring_alerts" DROP CONSTRAINT IF EXISTS "FK_1f892acd05b1791df87cbce6820"`);
    await queryRunner.query(`ALTER TABLE "monitoring_alerts" ADD CONSTRAINT "FK_1f892acd05b1791df87cbce6820" FOREIGN KEY ("case_id") REFERENCES "patient_cases"("case_id") ON DELETE CASCADE ON UPDATE NO ACTION NOT VALID`);
    await queryRunner.query(`ALTER TABLE "monitoring_alerts" VALIDATE CONSTRAINT "FK_1f892acd05b1791df87cbce6820"`);
    await queryRunner.query(`ALTER TABLE "monitoring_alerts" DROP CONSTRAINT IF EXISTS "FK_cc2040818e2d486da20aaece749"`);
    await queryRunner.query(`ALTER TABLE "monitoring_alerts" ADD CONSTRAINT "FK_cc2040818e2d486da20aaece749" FOREIGN KEY ("assessment_id") REFERENCES "patient_assessments"("assessment_id") ON DELETE CASCADE ON UPDATE NO ACTION NOT VALID`);
    await queryRunner.query(`ALTER TABLE "monitoring_alerts" VALIDATE CONSTRAINT "FK_cc2040818e2d486da20aaece749"`);
    await queryRunner.query(`ALTER TABLE "role_permissions" DROP CONSTRAINT IF EXISTS "FK_17022daf3f885f7d35423e9971e"`);
    await queryRunner.query(`ALTER TABLE "role_permissions" ADD CONSTRAINT "FK_17022daf3f885f7d35423e9971e" FOREIGN KEY ("permission_id") REFERENCES "permissions"("permission_id") ON DELETE CASCADE ON UPDATE CASCADE NOT VALID`);
    await queryRunner.query(`ALTER TABLE "role_permissions" VALIDATE CONSTRAINT "FK_17022daf3f885f7d35423e9971e"`);
    await queryRunner.query(`ALTER TABLE "role_permissions" DROP CONSTRAINT IF EXISTS "FK_178199805b901ccd220ab7740ec"`);
    await queryRunner.query(`ALTER TABLE "role_permissions" ADD CONSTRAINT "FK_178199805b901ccd220ab7740ec" FOREIGN KEY ("role_id") REFERENCES "roles"("role_id") ON DELETE NO ACTION ON UPDATE NO ACTION NOT VALID`);
    await queryRunner.query(`ALTER TABLE "role_permissions" VALIDATE CONSTRAINT "FK_178199805b901ccd220ab7740ec"`);
    await queryRunner.query(`ALTER TABLE "user_roles" DROP CONSTRAINT IF EXISTS "FK_87b8888186ca9769c960e926870"`);
    await queryRunner.query(`ALTER TABLE "user_roles" ADD CONSTRAINT "FK_87b8888186ca9769c960e926870" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE CASCADE ON UPDATE CASCADE NOT VALID`);
    await queryRunner.query(`ALTER TABLE "user_roles" VALIDATE CONSTRAINT "FK_87b8888186ca9769c960e926870"`);
    await queryRunner.query(`ALTER TABLE "user_roles" DROP CONSTRAINT IF EXISTS "FK_b23c65e50a758245a33ee35fda1"`);
    await queryRunner.query(`ALTER TABLE "user_roles" ADD CONSTRAINT "FK_b23c65e50a758245a33ee35fda1" FOREIGN KEY ("role_id") REFERENCES "roles"("role_id") ON DELETE NO ACTION ON UPDATE NO ACTION NOT VALID`);
    await queryRunner.query(`ALTER TABLE "user_roles" VALIDATE CONSTRAINT "FK_b23c65e50a758245a33ee35fda1"`);

    await queryRunner.query(`DROP INDEX IF EXISTS "idx_patient_cases_pod_sync"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "public"."idx_patient_cases_pod_sync"`);
    await queryRunner.query(`ALTER TABLE "levels" DROP CONSTRAINT IF EXISTS "UQ_levels_level_name"`);
    await queryRunner.query(`ALTER TABLE "operation_types" DROP CONSTRAINT IF EXISTS "UQ_operation_types_operation_name"`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_17022daf3f885f7d35423e9971" ON "role_permissions" ("permission_id") `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_178199805b901ccd220ab7740e" ON "role_permissions" ("role_id") `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_87b8888186ca9769c960e92687" ON "user_roles" ("user_id") `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_b23c65e50a758245a33ee35fda" ON "user_roles" ("role_id") `);

    // monitoring_alerts.alert_type: only convert enum -> varchar if it hasn't happened yet.
    // Guarded (rather than an unconditional DROP COLUMN + re-ADD) so this never wipes
    // alert_type values on a database where RenameColumnCamelCase already ran.
    const alertTypeColumn: Array<{ data_type: string }> = await queryRunner.query(`
      SELECT data_type FROM information_schema.columns
      WHERE table_schema = '${schemaName}' AND table_name = 'monitoring_alerts' AND column_name = 'alert_type'
    `);
    if (alertTypeColumn[0] && alertTypeColumn[0].data_type !== 'character varying') {
      await queryRunner.query(`ALTER TABLE "monitoring_alerts" DROP COLUMN "alert_type"`);
      await queryRunner.query(`DROP TYPE IF EXISTS "alerts_alert_type_enum"`);
      await queryRunner.query(`DROP TYPE IF EXISTS "public"."alerts_alert_type_enum"`);
      await queryRunner.query(`ALTER TABLE "monitoring_alerts" ADD "alert_type" character varying(10) NOT NULL DEFAULT 'YELLOW'`);
      await queryRunner.query(`ALTER TABLE "monitoring_alerts" ALTER COLUMN "alert_type" DROP DEFAULT`);
    }

    // --- CreateUserDevicesTable hardening: safe to re-run against a partially-provisioned DB ---
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS ${schema}."user_devices" (
        "device_id" SERIAL NOT NULL,
        "user_id" integer NOT NULL,
        "installation_id" character varying(150) NOT NULL,
        "fcm_token" character varying(500) NOT NULL,
        "platform" character varying(20) NOT NULL,
        "app_version" character varying(50),
        "os_version" character varying(50),
        "device_model" character varying(100),
        "timezone" character varying(100),
        "is_active" BOOLEAN NOT NULL DEFAULT TRUE,
        "last_seen_at" TIMESTAMP,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_user_devices_device_id" PRIMARY KEY ("device_id"),
        CONSTRAINT "UQ_user_devices_installation_id" UNIQUE ("installation_id"),
        CONSTRAINT "UQ_user_devices_fcm_token" UNIQUE ("fcm_token")
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_user_devices_user_id" ON ${schema}."user_devices" ("user_id")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_user_devices_is_active" ON ${schema}."user_devices" ("is_active")`);
    await queryRunner.query(`ALTER TABLE ${schema}."user_devices" DROP CONSTRAINT IF EXISTS "FK_user_devices_user_id"`);
    await queryRunner.query(`
      ALTER TABLE ${schema}."user_devices"
      ADD CONSTRAINT "FK_user_devices_user_id"
      FOREIGN KEY ("user_id") REFERENCES ${schema}."users"("user_id") ON DELETE CASCADE ON UPDATE NO ACTION NOT VALID
    `);
    await queryRunner.query(`ALTER TABLE ${schema}."user_devices" VALIDATE CONSTRAINT "FK_user_devices_user_id"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const schemaName = process.env.DB_SCHEMA ?? 'public';

    // Only the name_initials drop has a meaningful inverse; the rest of this migration
    // just re-affirms state that the migrations before it already own.
    await queryRunner.query(`
      DO $$
      DECLARE
        s text := '${schemaName}';
      BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = s AND table_name = 'patient_cases') THEN
          EXECUTE format('ALTER TABLE %I."patient_cases" ADD COLUMN IF NOT EXISTS name_initials VARCHAR(50)', s);
        ELSIF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = s AND table_name = 'patients') THEN
          EXECUTE format('ALTER TABLE %I."patients" ADD COLUMN IF NOT EXISTS name_initials VARCHAR(50)', s);
        END IF;
      END $$;
    `);
  }
}
