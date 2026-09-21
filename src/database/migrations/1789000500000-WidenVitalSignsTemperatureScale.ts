import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * `vital_signs.temperature_celsius` was `numeric(4,1)` (1 decimal place).
 * Widens it to `numeric(4,2)` so 2 decimal places can be recorded (e.g.
 * 36.85) — requested alongside dropping the blood-pressure/respiratory-rate
 * sanity bounds (see `CreateVitalSignDto`). Existing 1-decimal values are
 * unaffected; no data loss.
 */
export class WidenVitalSignsTemperatureScale1789000500000 implements MigrationInterface {
  name = 'WidenVitalSignsTemperatureScale1789000500000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const schemaName = process.env.DB_SCHEMA ?? 'public';
    const schema = `"${schemaName}"`;

    await queryRunner.query(`
      ALTER TABLE ${schema}."vital_signs"
      ALTER COLUMN "temperature_celsius" TYPE numeric(4,2)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const schemaName = process.env.DB_SCHEMA ?? 'public';
    const schema = `"${schemaName}"`;

    await queryRunner.query(`
      ALTER TABLE ${schema}."vital_signs"
      ALTER COLUMN "temperature_celsius" TYPE numeric(4,1)
    `);
  }
}
