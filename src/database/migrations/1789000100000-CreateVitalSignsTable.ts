import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Creates `vital_signs` — the append-only store behind the "Chỉ số" module
 * (pulse / blood pressure / temperature / respiratory rate / SpO2).
 *
 * `recorded_at` and `recorded_by_*` are always written server-side.
 */
export class CreateVitalSignsTable1789000100000 implements MigrationInterface {
  name = 'CreateVitalSignsTable1789000100000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const schemaName = process.env.DB_SCHEMA ?? 'public';
    const schema = `"${schemaName}"`;

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS ${schema}."vital_signs" (
        "vital_sign_id" SERIAL NOT NULL,
        "case_id" character varying NOT NULL,
        "pulse_bpm" integer NOT NULL,
        "blood_pressure_systolic" integer NOT NULL,
        "blood_pressure_diastolic" integer NOT NULL,
        "temperature_celsius" numeric(4,2) NOT NULL,
        "respiratory_rate" integer NOT NULL,
        "spo2_percent" integer NOT NULL,
        "note" TEXT,
        "recorded_by_user_id" integer,
        "recorded_by_name" character varying(255) NOT NULL,
        "recorded_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_vital_signs_vital_sign_id" PRIMARY KEY ("vital_sign_id")
      )
    `);

    await queryRunner.query(`
      ALTER TABLE ${schema}."vital_signs"
      ADD CONSTRAINT "FK_vital_signs_case"
      FOREIGN KEY ("case_id") REFERENCES ${schema}."patient_cases"("case_id")
      ON DELETE CASCADE ON UPDATE NO ACTION NOT VALID
    `);

    await queryRunner.query(`
      ALTER TABLE ${schema}."vital_signs" VALIDATE CONSTRAINT "FK_vital_signs_case"
    `);

    await queryRunner.query(`
      ALTER TABLE ${schema}."vital_signs"
      ADD CONSTRAINT "FK_vital_signs_recorded_by"
      FOREIGN KEY ("recorded_by_user_id") REFERENCES ${schema}."users"("user_id")
      ON DELETE SET NULL ON UPDATE NO ACTION NOT VALID
    `);

    await queryRunner.query(`
      ALTER TABLE ${schema}."vital_signs" VALIDATE CONSTRAINT "FK_vital_signs_recorded_by"
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_vital_signs_case_recorded_at"
      ON ${schema}."vital_signs" ("case_id", "recorded_at" DESC)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const schemaName = process.env.DB_SCHEMA ?? 'public';
    const schema = `"${schemaName}"`;

    await queryRunner.query(`DROP INDEX IF EXISTS ${schema}."IDX_vital_signs_case_recorded_at"`);
    await queryRunner.query(
      `ALTER TABLE IF EXISTS ${schema}."vital_signs" DROP CONSTRAINT IF EXISTS "FK_vital_signs_recorded_by"`,
    );
    await queryRunner.query(
      `ALTER TABLE IF EXISTS ${schema}."vital_signs" DROP CONSTRAINT IF EXISTS "FK_vital_signs_case"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS ${schema}."vital_signs"`);
  }
}
