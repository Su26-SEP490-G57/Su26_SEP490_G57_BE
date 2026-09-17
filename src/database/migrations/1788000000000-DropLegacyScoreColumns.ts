import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Final removal of all legacy numerical score columns.
 * Clinical classification is now fully triage-based (GREEN / YELLOW / RED).
 * The following data is preserved:
 *   - triage_color / triage_verdict_snapshot on patient_assessments
 *   - option_triage_level / option_triage_level_snapshot on options and detail rows
 *   - normalized_value / normalized_value_snapshot for clinical rule evaluation
 *   - All text snapshots (question_text_snapshot, option_text_snapshot)
 *
 * This migration is irreversible for the data dropped:
 *   - question_options.score_value
 *   - patient_assessments.total_score
 *   - patient_assessment_details.score_earned
 *   - monitoring_alerts.survey_score
 */
export class DropLegacyScoreColumns1788000000000 implements MigrationInterface {
  name = 'DropLegacyScoreColumns1788000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const schemaName = process.env.DB_SCHEMA ?? 'public';
    const schema = `"${schemaName}"`;

    await queryRunner.query(
      `ALTER TABLE ${schema}."question_options" DROP COLUMN IF EXISTS "score_value"`,
    );

    await queryRunner.query(
      `ALTER TABLE ${schema}."patient_assessments" DROP COLUMN IF EXISTS "total_score"`,
    );

    await queryRunner.query(
      `ALTER TABLE ${schema}."patient_assessment_details" DROP COLUMN IF EXISTS "score_earned"`,
    );

    await queryRunner.query(
      `ALTER TABLE ${schema}."monitoring_alerts" DROP COLUMN IF EXISTS "survey_score"`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const schemaName = process.env.DB_SCHEMA ?? 'public';
    const schema = `"${schemaName}"`;

    // Re-add columns as nullable so rollback does not block existing rows.
    // Historical score data cannot be recovered once this migration runs.
    await queryRunner.query(
      `ALTER TABLE ${schema}."monitoring_alerts" ADD COLUMN IF NOT EXISTS "survey_score" integer`,
    );

    await queryRunner.query(
      `ALTER TABLE ${schema}."patient_assessment_details" ADD COLUMN IF NOT EXISTS "score_earned" integer`,
    );

    await queryRunner.query(
      `ALTER TABLE ${schema}."patient_assessments" ADD COLUMN IF NOT EXISTS "total_score" integer`,
    );

    await queryRunner.query(
      `ALTER TABLE ${schema}."question_options" ADD COLUMN IF NOT EXISTS "score_value" integer`,
    );
  }
}
