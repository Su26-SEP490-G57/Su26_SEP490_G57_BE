import { MigrationInterface, QueryRunner } from 'typeorm';

export class UpdateAppEngagementLogColumns1781625400000 implements MigrationInterface {
  name = 'UpdateAppEngagementLogColumns1781625400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const schemaName = process.env.DB_SCHEMA ?? 'public';
    const schema = `"${schemaName}"`;

    // ── Remove the deprecated engagement counters ───────────────────────────────
    await queryRunner.query(`ALTER TABLE ${schema}."app_engagement_logs" DROP COLUMN IF EXISTS "reminder_count"`);
    await queryRunner.query(`ALTER TABLE ${schema}."app_engagement_logs" DROP COLUMN IF EXISTS "app_access_count"`);
    await queryRunner.query(`ALTER TABLE ${schema}."app_engagement_logs" DROP COLUMN IF EXISTS "call_nurse_clicks"`);

    // ── Track how many self-assessments the patient has completed ───────────────
    await queryRunner.query(`
      ALTER TABLE ${schema}."app_engagement_logs"
      ADD COLUMN IF NOT EXISTS "assessment_completed_count" integer
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const schemaName = process.env.DB_SCHEMA ?? 'public';
    const schema = `"${schemaName}"`;

    await queryRunner.query(`ALTER TABLE ${schema}."app_engagement_logs" DROP COLUMN IF EXISTS "assessment_completed_count"`);

    await queryRunner.query(`ALTER TABLE ${schema}."app_engagement_logs" ADD COLUMN IF NOT EXISTS "call_nurse_clicks" integer`);
    await queryRunner.query(`ALTER TABLE ${schema}."app_engagement_logs" ADD COLUMN IF NOT EXISTS "app_access_count" integer`);
    await queryRunner.query(`ALTER TABLE ${schema}."app_engagement_logs" ADD COLUMN IF NOT EXISTS "reminder_count" integer`);
  }
}
