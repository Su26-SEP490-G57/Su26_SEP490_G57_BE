import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddIsDefaultToSurveyQuestions1781900000000 implements MigrationInterface {
  name = 'AddIsDefaultToSurveyQuestions1781900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const schemaName = process.env.DB_SCHEMA ?? 'public';
    const schema = `"${schemaName}"`;

    await queryRunner.query(`
      ALTER TABLE ${schema}."survey_questions"
      ADD COLUMN IF NOT EXISTS "is_default" boolean NOT NULL DEFAULT false
    `);

    // Questions seeded by the core-table migration are the built-in defaults.
    await queryRunner.query(`
      UPDATE ${schema}."survey_questions"
      SET "is_default" = true
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const schemaName = process.env.DB_SCHEMA ?? 'public';
    const schema = `"${schemaName}"`;

    await queryRunner.query(`
      ALTER TABLE ${schema}."survey_questions"
      DROP COLUMN IF EXISTS "is_default"
    `);
  }
}
