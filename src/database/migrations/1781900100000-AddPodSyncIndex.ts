import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPodSyncIndex1781900100000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    const schema = `"${process.env.DB_SCHEMA ?? 'public'}"`;

    // Partial index — only covers rows the cron actually touches:
    // non-locked, active patients with ERAS started (pod_start_date IS NOT NULL)
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_patient_cases_pod_sync"
      ON ${schema}."patient_cases" (pod_start_date, current_pod)
      WHERE is_locked = false AND deleted_at IS NULL AND pod_start_date IS NOT NULL
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    const schema = `"${process.env.DB_SCHEMA ?? 'public'}"`;
    await queryRunner.query(`DROP INDEX IF EXISTS ${schema}."idx_patient_cases_pod_sync"`);
  }
}
