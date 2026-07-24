import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddErasCompletedToPatientCases1784653095595 implements MigrationInterface {
  name = 'AddErasCompletedToPatientCases1784653095595';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const schemaName = process.env.DB_SCHEMA ?? 'public';
    const schema = `"${schemaName}"`;

    console.log('[AddErasCompletedToPatientCases] Adding eras_completed column...');

    // Add eras_completed column to patient_cases table
    await queryRunner.query(`
      ALTER TABLE ${schema}."patient_cases"
      ADD COLUMN IF NOT EXISTS "eras_completed" BOOLEAN NOT NULL DEFAULT FALSE
    `);

    // Add comment to document the column purpose
    await queryRunner.query(`
      COMMENT ON COLUMN ${schema}."patient_cases"."eras_completed"
      IS 'Indicates whether the patient has completed the ERAS protocol (reached max POD)'
    `);

    console.log('[AddErasCompletedToPatientCases] Successfully added eras_completed column');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const schemaName = process.env.DB_SCHEMA ?? 'public';
    const schema = `"${schemaName}"`;

    // Remove eras_completed column
    await queryRunner.query(`
      ALTER TABLE ${schema}."patient_cases"
      DROP COLUMN IF EXISTS "eras_completed"
    `);
  }
}
