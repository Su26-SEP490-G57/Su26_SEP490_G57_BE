import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Creates the `care_level_enum` Postgres type, the `treatment_orders` table and
 * the two mirror columns on `patient_cases`.
 *
 * The enum type is created here by hand and pinned from the entities via
 * `enumName` (same convention as `pod_tracking_logs_action_type_enum`) so
 * `migration:generate` never proposes recreating it.
 *
 * `patient_cases.active_care_level` is a NEW, separate concept from the
 * existing `level_id` (Red/Yellow/Green ERAS triage) — the two never mix.
 */
export class CreateCareLevelEnumAndTreatmentOrders1789000200000 implements MigrationInterface {
  name = 'CreateCareLevelEnumAndTreatmentOrders1789000200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const schemaName = process.env.DB_SCHEMA ?? 'public';
    const schema = `"${schemaName}"`;

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_type t
          JOIN pg_namespace n ON n.oid = t.typnamespace
          WHERE t.typname = 'care_level_enum' AND n.nspname = '${schemaName}'
        ) THEN
          CREATE TYPE ${schema}."care_level_enum" AS ENUM ('LEVEL_1', 'LEVEL_2', 'LEVEL_3');
        END IF;
      END
      $$
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS ${schema}."treatment_orders" (
        "treatment_order_id" SERIAL NOT NULL,
        "case_id" character varying NOT NULL,
        "care_level" ${schema}."care_level_enum" NOT NULL,
        "instructions" TEXT,
        "ordered_by_user_id" integer,
        "ordered_by_name" character varying(255) NOT NULL,
        "ordered_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT now(),
        CONSTRAINT "PK_treatment_orders_treatment_order_id" PRIMARY KEY ("treatment_order_id")
      )
    `);

    await queryRunner.query(`
      ALTER TABLE ${schema}."treatment_orders"
      ADD CONSTRAINT "FK_treatment_orders_case"
      FOREIGN KEY ("case_id") REFERENCES ${schema}."patient_cases"("case_id")
      ON DELETE CASCADE ON UPDATE NO ACTION NOT VALID
    `);

    await queryRunner.query(`
      ALTER TABLE ${schema}."treatment_orders" VALIDATE CONSTRAINT "FK_treatment_orders_case"
    `);

    await queryRunner.query(`
      ALTER TABLE ${schema}."treatment_orders"
      ADD CONSTRAINT "FK_treatment_orders_ordered_by"
      FOREIGN KEY ("ordered_by_user_id") REFERENCES ${schema}."users"("user_id")
      ON DELETE SET NULL ON UPDATE NO ACTION NOT VALID
    `);

    await queryRunner.query(`
      ALTER TABLE ${schema}."treatment_orders" VALIDATE CONSTRAINT "FK_treatment_orders_ordered_by"
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_treatment_orders_case_ordered_at"
      ON ${schema}."treatment_orders" ("case_id", "ordered_at" DESC)
    `);

    await queryRunner.query(`
      ALTER TABLE ${schema}."patient_cases"
      ADD COLUMN IF NOT EXISTS "active_care_level" ${schema}."care_level_enum",
      ADD COLUMN IF NOT EXISTS "active_treatment_order_id" integer
    `);

    await queryRunner.query(`
      ALTER TABLE ${schema}."patient_cases"
      ADD CONSTRAINT "FK_patient_cases_active_treatment_order"
      FOREIGN KEY ("active_treatment_order_id")
      REFERENCES ${schema}."treatment_orders"("treatment_order_id")
      ON DELETE SET NULL ON UPDATE NO ACTION NOT VALID
    `);

    await queryRunner.query(`
      ALTER TABLE ${schema}."patient_cases"
      VALIDATE CONSTRAINT "FK_patient_cases_active_treatment_order"
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const schemaName = process.env.DB_SCHEMA ?? 'public';
    const schema = `"${schemaName}"`;

    await queryRunner.query(
      `ALTER TABLE ${schema}."patient_cases" DROP CONSTRAINT IF EXISTS "FK_patient_cases_active_treatment_order"`,
    );
    await queryRunner.query(
      `ALTER TABLE ${schema}."patient_cases" DROP COLUMN IF EXISTS "active_treatment_order_id", DROP COLUMN IF EXISTS "active_care_level"`,
    );

    await queryRunner.query(
      `DROP INDEX IF EXISTS ${schema}."IDX_treatment_orders_case_ordered_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE IF EXISTS ${schema}."treatment_orders" DROP CONSTRAINT IF EXISTS "FK_treatment_orders_ordered_by"`,
    );
    await queryRunner.query(
      `ALTER TABLE IF EXISTS ${schema}."treatment_orders" DROP CONSTRAINT IF EXISTS "FK_treatment_orders_case"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS ${schema}."treatment_orders"`);
    await queryRunner.query(`DROP TYPE IF EXISTS ${schema}."care_level_enum"`);
  }
}
