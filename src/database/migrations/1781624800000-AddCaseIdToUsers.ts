import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCaseIdToUsers1781624800000 implements MigrationInterface {
  name = 'AddCaseIdToUsers1781624800000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const schemaName = process.env.DB_SCHEMA ?? 'public';
    const schema = `"${schemaName}"`;

    await queryRunner.query(`
      ALTER TABLE ${schema}."users"
      ADD COLUMN IF NOT EXISTS "case_id" character varying
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const schemaName = process.env.DB_SCHEMA ?? 'public';
    const schema = `"${schemaName}"`;

    await queryRunner.query(`
      ALTER TABLE ${schema}."users"
      DROP COLUMN IF EXISTS "case_id"
    `);
  }
}
