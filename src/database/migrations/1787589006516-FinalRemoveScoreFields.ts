import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds the immutable clinical triage verdict snapshot required by Diet Level
 * progression. Legacy score columns stay in place until every read/write path
 * has been migrated away from them.
 */
export class FinalRemoveScoreFields1787589006516 implements MigrationInterface {
  name = 'FinalRemoveScoreFields1787589006516';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const schemaName = process.env.DB_SCHEMA ?? 'public';
    const schema = `"${schemaName}"`;

    await queryRunner.query(`
      ALTER TABLE ${schema}."patient_assessments"
      ADD COLUMN IF NOT EXISTS "triage_verdict_snapshot" character varying(20)
    `);

    // Historical surveys were persisted with triage_color. Preserve that clinical
    // conclusion as the immutable snapshot instead of recalculating from legacy scores.
    await queryRunner.query(`
      UPDATE ${schema}."patient_assessments"
      SET "triage_verdict_snapshot" = UPPER("triage_color")
      WHERE "triage_verdict_snapshot" IS NULL
        AND UPPER("triage_color") IN ('GREEN', 'YELLOW', 'RED')
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_constraint
          WHERE conname = 'CHK_patient_assessments_triage_verdict_snapshot'
            AND connamespace = '${schemaName}'::regnamespace
        ) THEN
          ALTER TABLE ${schema}."patient_assessments"
          ADD CONSTRAINT "CHK_patient_assessments_triage_verdict_snapshot"
          CHECK (
            "triage_verdict_snapshot" IS NULL
            OR "triage_verdict_snapshot" IN ('GREEN', 'YELLOW', 'RED')
          );
        END IF;
      END $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const schemaName = process.env.DB_SCHEMA ?? 'public';
    const schema = `"${schemaName}"`;

    await queryRunner.query(`
      ALTER TABLE ${schema}."patient_assessments"
      DROP CONSTRAINT IF EXISTS "CHK_patient_assessments_triage_verdict_snapshot"
    `);

    await queryRunner.query(`
      ALTER TABLE ${schema}."patient_assessments"
      DROP COLUMN IF EXISTS "triage_verdict_snapshot"
    `);
  }
}
