import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * The nurse analytics dashboard (SEP490-377) needs `reminder_count` and
 * `app_access_count` back on `app_engagement_logs` — they were dropped by
 * UpdateAppEngagementLogColumns1781625400000. `assessment_completed_count`
 * survived that migration but was left nullable with no default; the FE
 * always wants a number for all three counters, so this backfills existing
 * NULLs to 0 and sets a NOT NULL DEFAULT 0 on all three columns.
 */
export class RestoreAppEngagementCounters1785137600000 implements MigrationInterface {
  name = 'RestoreAppEngagementCounters1785137600000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const schemaName = process.env.DB_SCHEMA ?? 'public';
    const schema = `"${schemaName}"`;

    // ── Restore the dropped engagement counters ──────────────────────────────
    await queryRunner.query(`
      ALTER TABLE ${schema}."app_engagement_logs"
      ADD COLUMN IF NOT EXISTS "reminder_count" integer NOT NULL DEFAULT 0
    `);
    await queryRunner.query(`
      ALTER TABLE ${schema}."app_engagement_logs"
      ADD COLUMN IF NOT EXISTS "app_access_count" integer NOT NULL DEFAULT 0
    `);

    // ── Backfill + default the surviving counter so all three are never null ──
    await queryRunner.query(`
      UPDATE ${schema}."app_engagement_logs"
      SET "assessment_completed_count" = 0
      WHERE "assessment_completed_count" IS NULL
    `);
    await queryRunner.query(`
      ALTER TABLE ${schema}."app_engagement_logs"
      ALTER COLUMN "assessment_completed_count" SET DEFAULT 0
    `);
    await queryRunner.query(`
      ALTER TABLE ${schema}."app_engagement_logs"
      ALTER COLUMN "assessment_completed_count" SET NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const schemaName = process.env.DB_SCHEMA ?? 'public';
    const schema = `"${schemaName}"`;

    await queryRunner.query(`
      ALTER TABLE ${schema}."app_engagement_logs"
      ALTER COLUMN "assessment_completed_count" DROP NOT NULL
    `);
    await queryRunner.query(`
      ALTER TABLE ${schema}."app_engagement_logs"
      ALTER COLUMN "assessment_completed_count" DROP DEFAULT
    `);

    await queryRunner.query(`ALTER TABLE ${schema}."app_engagement_logs" DROP COLUMN IF EXISTS "app_access_count"`);
    await queryRunner.query(`ALTER TABLE ${schema}."app_engagement_logs" DROP COLUMN IF EXISTS "reminder_count"`);
  }
}
