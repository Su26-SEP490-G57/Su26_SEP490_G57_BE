import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateOperationTypesTable1781625000000 implements MigrationInterface {
  name = 'CreateOperationTypesTable1781625000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const schemaName = process.env.DB_SCHEMA ?? 'public';
    const schema = `"${schemaName}"`;

    // ── Master config table: operation types ───────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS ${schema}."operation_types" (
        "operation_type_id" SERIAL                   NOT NULL,
        "operation_name"    character varying(100)    NOT NULL,
        CONSTRAINT "PK_operation_types_operation_type_id"   PRIMARY KEY ("operation_type_id"),
        CONSTRAINT "UQ_operation_types_operation_name"      UNIQUE ("operation_name")
      )
    `);

    // ── Backfill master table from existing patient_cases.operation_type values ─
    await queryRunner.query(`
      INSERT INTO ${schema}."operation_types" ("operation_name")
      SELECT DISTINCT "operation_type"
      FROM ${schema}."patient_cases"
      WHERE "operation_type" IS NOT NULL AND "operation_type" <> ''
      ON CONFLICT ("operation_name") DO NOTHING
    `);

    // ── Relationship: patient_cases.operation_type_id -> operation_types ────────
    await queryRunner.query(`
      ALTER TABLE ${schema}."patient_cases"
      ADD COLUMN IF NOT EXISTS "operation_type_id" integer
    `);

    // ── Backfill the FK links from the old varchar values ───────────────────────
    await queryRunner.query(`
      UPDATE ${schema}."patient_cases" pc
      SET "operation_type_id" = ot."operation_type_id"
      FROM ${schema}."operation_types" ot
      WHERE pc."operation_type" = ot."operation_name"
    `);

    await queryRunner.query(`
      ALTER TABLE ${schema}."patient_cases"
      ADD CONSTRAINT "FK_patient_cases_operation_type_id"
      FOREIGN KEY ("operation_type_id") REFERENCES ${schema}."operation_types"("operation_type_id") ON DELETE SET NULL ON UPDATE NO ACTION
    `);

    // ── Drop the now-redundant varchar column ───────────────────────────────────
    await queryRunner.query(`
      ALTER TABLE ${schema}."patient_cases"
      DROP COLUMN IF EXISTS "operation_type"
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const schemaName = process.env.DB_SCHEMA ?? 'public';
    const schema = `"${schemaName}"`;

    // Re-create the varchar column
    await queryRunner.query(`
      ALTER TABLE ${schema}."patient_cases"
      ADD COLUMN IF NOT EXISTS "operation_type" character varying(100)
    `);

    // Restore values from the master table via the FK
    await queryRunner.query(`
      UPDATE ${schema}."patient_cases" pc
      SET "operation_type" = ot."operation_name"
      FROM ${schema}."operation_types" ot
      WHERE pc."operation_type_id" = ot."operation_type_id"
    `);

    await queryRunner.query(`
      ALTER TABLE ${schema}."patient_cases"
      DROP CONSTRAINT IF EXISTS "FK_patient_cases_operation_type_id"
    `);
    await queryRunner.query(`
      ALTER TABLE ${schema}."patient_cases"
      DROP COLUMN IF EXISTS "operation_type_id"
    `);
    await queryRunner.query(`DROP TABLE IF EXISTS ${schema}."operation_types"`);
  }
}
