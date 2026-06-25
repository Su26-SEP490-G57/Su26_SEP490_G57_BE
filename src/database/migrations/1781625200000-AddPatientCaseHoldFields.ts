import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPatientCaseHoldFields1781625200000 implements MigrationInterface {
  name = 'AddPatientCaseHoldFields1781625200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const schemaName = process.env.DB_SCHEMA ?? 'public';
    const schema = `"${schemaName}"`;

    // ── Hold / lock metadata on patient cases ───────────────────────────────────
    await queryRunner.query(`
      ALTER TABLE ${schema}."patient_cases"
      ADD COLUMN IF NOT EXISTS "is_locked" BOOLEAN NOT NULL DEFAULT FALSE
    `);
    await queryRunner.query(`
      ALTER TABLE ${schema}."patient_cases"
      ADD COLUMN IF NOT EXISTS "guardian_phone" character varying(20)
    `);
    await queryRunner.query(`
      ALTER TABLE ${schema}."patient_cases"
      ADD COLUMN IF NOT EXISTS "reason_hold_pod" TEXT
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const schemaName = process.env.DB_SCHEMA ?? 'public';
    const schema = `"${schemaName}"`;

    await queryRunner.query(`ALTER TABLE ${schema}."patient_cases" DROP COLUMN IF EXISTS "reason_hold_pod"`);
    await queryRunner.query(`ALTER TABLE ${schema}."patient_cases" DROP COLUMN IF EXISTS "guardian_phone"`);
    await queryRunner.query(`ALTER TABLE ${schema}."patient_cases" DROP COLUMN IF EXISTS "is_locked"`);
  }
}
