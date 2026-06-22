import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSoftDeleteColumns1781625100000 implements MigrationInterface {
  name = 'AddSoftDeleteColumns1781625100000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const schemaName = process.env.DB_SCHEMA ?? 'public';
    const schema = `"${schemaName}"`;

    // ── Soft-delete marker (NULL = active, timestamp = soft-deleted) ────────────
    await queryRunner.query(`
      ALTER TABLE ${schema}."patient_cases"
      ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMP
    `);

    await queryRunner.query(`
      ALTER TABLE ${schema}."users"
      ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMP
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const schemaName = process.env.DB_SCHEMA ?? 'public';
    const schema = `"${schemaName}"`;

    await queryRunner.query(`
      ALTER TABLE ${schema}."users"
      DROP COLUMN IF EXISTS "deleted_at"
    `);

    await queryRunner.query(`
      ALTER TABLE ${schema}."patient_cases"
      DROP COLUMN IF EXISTS "deleted_at"
    `);
  }
}
