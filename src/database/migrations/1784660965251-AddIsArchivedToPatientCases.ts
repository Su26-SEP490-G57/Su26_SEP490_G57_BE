import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddIsArchivedToPatientCases1784660965251 implements MigrationInterface {
  name = 'AddIsArchivedToPatientCases1784660965251';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const schemaName = process.env.DB_SCHEMA ?? 'public';
    const schema = `"${schemaName}"`;

    console.log('[AddIsArchivedToPatientCases] Adding is_archived column...');

    // Add is_archived column to patient_cases table
    await queryRunner.query(`
      ALTER TABLE ${schema}."patient_cases"
      ADD COLUMN IF NOT EXISTS "is_archived" BOOLEAN NOT NULL DEFAULT FALSE
    `);

    // Add comment to document the column purpose
    await queryRunner.query(`
      COMMENT ON COLUMN ${schema}."patient_cases"."is_archived"
      IS 'Indicates whether the patient record has been archived (moved to archive view)'
    `);

    console.log('[AddIsArchivedToPatientCases] Successfully added is_archived column');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const schemaName = process.env.DB_SCHEMA ?? 'public';
    const schema = `"${schemaName}"`;

    // Remove is_archived column
    await queryRunner.query(`
      ALTER TABLE ${schema}."patient_cases"
      DROP COLUMN IF EXISTS "is_archived"
    `);
  }
}
