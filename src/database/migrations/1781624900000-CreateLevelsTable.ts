import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateLevelsTable1781624900000 implements MigrationInterface {
  name = 'CreateLevelsTable1781624900000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const schemaName = process.env.DB_SCHEMA ?? 'public';
    const schema = `"${schemaName}"`;

    // ── Master config table: patient risk/care levels (Red / Yellow / Green) ────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS ${schema}."levels" (
        "level_id"    SERIAL                   NOT NULL,
        "level_name"  character varying(20)    NOT NULL,
        "description" character varying(255),
        "sort_order"  integer                  NOT NULL DEFAULT 0,
        CONSTRAINT "PK_levels_level_id"     PRIMARY KEY ("level_id"),
        CONSTRAINT "UQ_levels_level_name"   UNIQUE ("level_name")
      )
    `);

    // ── Seed the three fixed levels (Red = highest priority) ────────────────────
    await queryRunner.query(`
      INSERT INTO ${schema}."levels" ("level_name", "description", "sort_order")
      VALUES
        ('Red',    'High risk - immediate attention required', 1),
        ('Yellow', 'Moderate risk - monitor closely',          2),
        ('Green',  'Low risk - stable',                        3)
      ON CONFLICT ("level_name") DO NOTHING
    `);

    // ── Relationship: patient_cases.level_id -> levels.level_id ─────────────────
    await queryRunner.query(`
      ALTER TABLE ${schema}."patient_cases"
      ADD COLUMN IF NOT EXISTS "level_id" integer
    `);

    await queryRunner.query(`
      ALTER TABLE ${schema}."patient_cases"
      ADD CONSTRAINT "FK_patient_cases_level_id"
      FOREIGN KEY ("level_id") REFERENCES ${schema}."levels"("level_id") ON DELETE SET NULL ON UPDATE NO ACTION
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const schemaName = process.env.DB_SCHEMA ?? 'public';
    const schema = `"${schemaName}"`;

    await queryRunner.query(`
      ALTER TABLE ${schema}."patient_cases"
      DROP CONSTRAINT IF EXISTS "FK_patient_cases_level_id"
    `);
    await queryRunner.query(`
      ALTER TABLE ${schema}."patient_cases"
      DROP COLUMN IF EXISTS "level_id"
    `);
    await queryRunner.query(`DROP TABLE IF EXISTS ${schema}."levels"`);
  }
}
