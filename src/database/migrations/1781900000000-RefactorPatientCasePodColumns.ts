import { MigrationInterface, QueryRunner } from 'typeorm';

export class RefactorPatientCasePodColumns1781900000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    const schema = `"${process.env.DB_SCHEMA ?? 'public'}"`;

    // Ensure pod_start_date and pod_end_date exist (TIMESTAMPTZ for precision)
    await queryRunner.query(`
      ALTER TABLE ${schema}."patient_cases"
      ADD COLUMN IF NOT EXISTS "pod_start_date" TIMESTAMPTZ NULL
    `);
    await queryRunner.query(`
      ALTER TABLE ${schema}."patient_cases"
      ADD COLUMN IF NOT EXISTS "pod_end_date" TIMESTAMPTZ NULL
    `);

    // Discharge date — separate from pod_end_date (patient may be discharged after ERAS ends)
    await queryRunner.query(`
      ALTER TABLE ${schema}."patient_cases"
      ADD COLUMN IF NOT EXISTS "discharge_date" TIMESTAMPTZ NULL
    `);

    // locked_at — timestamp when POD was locked
    await queryRunner.query(`
      ALTER TABLE ${schema}."patient_cases"
      ADD COLUMN IF NOT EXISTS "locked_at" TIMESTAMPTZ NULL
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    const schema = `"${process.env.DB_SCHEMA ?? 'public'}"`;

    await queryRunner.query(`ALTER TABLE ${schema}."patient_cases" DROP COLUMN IF EXISTS "locked_at"`);
    await queryRunner.query(`ALTER TABLE ${schema}."patient_cases" DROP COLUMN IF EXISTS "discharge_date"`);
    await queryRunner.query(`ALTER TABLE ${schema}."patient_cases" DROP COLUMN IF EXISTS "pod_end_date"`);
    await queryRunner.query(`ALTER TABLE ${schema}."patient_cases" DROP COLUMN IF EXISTS "pod_start_date"`);
  }
}
