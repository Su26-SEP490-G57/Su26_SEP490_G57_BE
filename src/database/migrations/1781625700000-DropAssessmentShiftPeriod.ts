import { MigrationInterface, QueryRunner } from 'typeorm';

export class DropAssessmentShiftPeriod1781625700000 implements MigrationInterface {
  name = 'DropAssessmentShiftPeriod1781625700000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const schemaName = process.env.DB_SCHEMA ?? 'public';
    const schema = `"${schemaName}"`;

    await queryRunner.query(`ALTER TABLE ${schema}."patient_assessments" DROP COLUMN IF EXISTS "shift_period"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const schemaName = process.env.DB_SCHEMA ?? 'public';
    const schema = `"${schemaName}"`;

    await queryRunner.query(`
      ALTER TABLE ${schema}."patient_assessments"
      ADD COLUMN IF NOT EXISTS "shift_period" character varying(20)
    `);
  }
}
