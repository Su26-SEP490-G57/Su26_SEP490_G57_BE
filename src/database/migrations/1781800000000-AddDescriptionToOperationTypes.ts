import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddDescriptionToOperationTypes1781800000000 implements MigrationInterface {
  name = 'AddDescriptionToOperationTypes1781800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const schemaName = process.env.DB_SCHEMA ?? 'public';
    const schema = `"${schemaName}"`;

    await queryRunner.query(`
      ALTER TABLE ${schema}."operation_types"
      ADD COLUMN IF NOT EXISTS "description" TEXT
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const schemaName = process.env.DB_SCHEMA ?? 'public';
    const schema = `"${schemaName}"`;

    await queryRunner.query(`
      ALTER TABLE ${schema}."operation_types"
      DROP COLUMN IF EXISTS "description"
    `);
  }
}
