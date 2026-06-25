import { MigrationInterface, QueryRunner } from 'typeorm';

export class DropMonitoringAlertColumns1781625300000 implements MigrationInterface {
  name = 'DropMonitoringAlertColumns1781625300000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const schemaName = process.env.DB_SCHEMA ?? 'public';
    const schema = `"${schemaName}"`;

    // ── Remove the nurse-assignment FK before dropping its column ────────────────
    await queryRunner.query(`
      ALTER TABLE ${schema}."monitoring_alerts"
      DROP CONSTRAINT IF EXISTS "FK_monitoring_alerts_assigned_nurse_id"
    `);

    await queryRunner.query(`ALTER TABLE ${schema}."monitoring_alerts" DROP COLUMN IF EXISTS "assigned_nurse_id"`);
    await queryRunner.query(`ALTER TABLE ${schema}."monitoring_alerts" DROP COLUMN IF EXISTS "acknowledged_at"`);
    await queryRunner.query(`ALTER TABLE ${schema}."monitoring_alerts" DROP COLUMN IF EXISTS "is_doctor_notified"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const schemaName = process.env.DB_SCHEMA ?? 'public';
    const schema = `"${schemaName}"`;

    await queryRunner.query(`
      ALTER TABLE ${schema}."monitoring_alerts"
      ADD COLUMN IF NOT EXISTS "is_doctor_notified" BOOLEAN
    `);
    await queryRunner.query(`
      ALTER TABLE ${schema}."monitoring_alerts"
      ADD COLUMN IF NOT EXISTS "acknowledged_at" TIMESTAMP
    `);
    await queryRunner.query(`
      ALTER TABLE ${schema}."monitoring_alerts"
      ADD COLUMN IF NOT EXISTS "assigned_nurse_id" integer
    `);
    await queryRunner.query(`
      ALTER TABLE ${schema}."monitoring_alerts"
      ADD CONSTRAINT "FK_monitoring_alerts_assigned_nurse_id"
      FOREIGN KEY ("assigned_nurse_id") REFERENCES ${schema}."users"("user_id") ON DELETE SET NULL ON UPDATE NO ACTION
    `);
  }
}
