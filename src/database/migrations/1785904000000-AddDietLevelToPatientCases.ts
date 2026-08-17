import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddDietLevelToPatientCases1785904000000 implements MigrationInterface {
  name = 'AddDietLevelToPatientCases1785904000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const schemaName = process.env.DB_SCHEMA ?? 'public';
    const schema = `"${schemaName}"`;

    await queryRunner.query(`
      ALTER TABLE ${schema}."patient_cases"
      ADD COLUMN IF NOT EXISTS "current_diet_level" integer NOT NULL DEFAULT 0
    `);

    await queryRunner.query(`
      ALTER TABLE ${schema}."pod_protocols"
      ADD COLUMN IF NOT EXISTS "diet_level" integer NOT NULL DEFAULT 0
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const schemaName = process.env.DB_SCHEMA ?? 'public';
    const schema = `"${schemaName}"`;

    await queryRunner.query(`
      ALTER TABLE ${schema}."pod_protocols"
      DROP COLUMN IF EXISTS "diet_level"
    `);

    await queryRunner.query(`
      ALTER TABLE ${schema}."patient_cases"
      DROP COLUMN IF EXISTS "current_diet_level"
    `);
  }
}
