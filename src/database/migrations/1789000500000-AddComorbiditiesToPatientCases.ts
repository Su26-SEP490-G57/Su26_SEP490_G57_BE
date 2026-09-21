import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddComorbiditiesToPatientCases1789000500000 implements MigrationInterface {
  name = 'AddComorbiditiesToPatientCases1789000500000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const schemaName = process.env.DB_SCHEMA ?? 'public';
    const schema = `"${schemaName}"`;

    await queryRunner.query(`
      ALTER TABLE ${schema}."patient_cases"
      ADD COLUMN IF NOT EXISTS "comorbidities" TEXT[]
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const schemaName = process.env.DB_SCHEMA ?? 'public';
    const schema = `"${schemaName}"`;

    await queryRunner.query(`
      ALTER TABLE ${schema}."patient_cases"
      DROP COLUMN IF EXISTS "comorbidities"
    `);
  }
}
