import { MigrationInterface, QueryRunner } from 'typeorm';

export class FixPodStartDateType1781900400000 implements MigrationInterface {
  name = 'FixPodStartDateType1781900400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const schemaName = process.env.DB_SCHEMA ?? 'public';
    const schema = `"${schemaName}"`;

    console.log('[FixPodStartDateType] Changing pod_start_date from DATE to TIMESTAMPTZ...');

    // Change column type from DATE to TIMESTAMPTZ to preserve time precision
    await queryRunner.query(`
      ALTER TABLE ${schema}."patient_cases"
      ALTER COLUMN "pod_start_date" TYPE TIMESTAMPTZ USING "pod_start_date"::TIMESTAMPTZ
    `);

    console.log('[FixPodStartDateType] Successfully changed pod_start_date to TIMESTAMPTZ');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const schemaName = process.env.DB_SCHEMA ?? 'public';
    const schema = `"${schemaName}"`;

    // Revert to DATE type (will lose time precision)
    await queryRunner.query(`
      ALTER TABLE ${schema}."patient_cases"
      ALTER COLUMN "pod_start_date" TYPE DATE USING "pod_start_date"::DATE
    `);
  }
}
