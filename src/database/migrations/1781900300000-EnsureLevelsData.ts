/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/require-await */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { MigrationInterface, QueryRunner } from 'typeorm';

export class EnsureLevelsData1781900300000 implements MigrationInterface {
  name = 'EnsureLevelsData1781900300000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const schemaName = process.env.DB_SCHEMA ?? 'public';
    const schema = `"${schemaName}"`;

    // Check if levels table has data
    const result = await queryRunner.query(`SELECT COUNT(*) as count FROM ${schema}."levels"`);
    const count = parseInt(result[0]?.count || '0', 10);

    console.log(`[EnsureLevelsData] Current levels count: ${count}`);

    if (count === 0) {
      console.log('[EnsureLevelsData] Levels table is empty. Inserting seed data...');
      await queryRunner.query(`
        INSERT INTO ${schema}."levels" ("level_name", "description", "sort_order")
        VALUES
          ('Red',    'High risk - immediate attention required', 1),
          ('Yellow', 'Moderate risk - monitor closely',          2),
          ('Green',  'Low risk - stable',                        3)
      `);
      console.log('[EnsureLevelsData] Levels data inserted successfully');
    } else {
      console.log('[EnsureLevelsData] Levels table already has data. Skipping insert.');
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // This migration is idempotent and only ensures data exists
    // We don't remove data on down migration
    console.log('[EnsureLevelsData] Down migration - no action taken');
  }
}
