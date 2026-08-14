import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddRedAlertUnlockNotification1786543200000 implements MigrationInterface {
  name = 'AddRedAlertUnlockNotification1786543200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const schemaName = process.env.DB_SCHEMA ?? 'public';
    const schema = `"${schemaName}"`;

    await queryRunner.query(`
      ALTER TABLE ${schema}."monitoring_alerts"
      ADD COLUMN "unlock_notified_at" TIMESTAMP WITH TIME ZONE NULL
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_monitoring_alerts_handled_red_unlock_notification"
      ON ${schema}."monitoring_alerts" ("triggered_at")
      WHERE "alert_type" = 'RED'
        AND "status" = 'HANDLED'
        AND "unlock_notified_at" IS NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const schemaName = process.env.DB_SCHEMA ?? 'public';
    const schema = `"${schemaName}"`;

    await queryRunner.query(
      `DROP INDEX ${schema}."IDX_monitoring_alerts_handled_red_unlock_notification"`,
    );
    await queryRunner.query(
      `ALTER TABLE ${schema}."monitoring_alerts" DROP COLUMN "unlock_notified_at"`,
    );
  }
}
