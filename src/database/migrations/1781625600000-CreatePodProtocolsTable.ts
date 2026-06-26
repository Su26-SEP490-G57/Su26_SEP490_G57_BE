import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreatePodProtocolsTable1781625600000 implements MigrationInterface {
  name = 'CreatePodProtocolsTable1781625600000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const schemaName = process.env.DB_SCHEMA ?? 'public';
    const schema = `"${schemaName}"`;

    // ── Master config table: per-operation-type POD diet protocols ──────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS ${schema}."pod_protocols" (
        "pod_id"               SERIAL                   NOT NULL,
        "operation_type_id"    integer                  NOT NULL,
        "label"                character varying(50)    NOT NULL,
        "meals_per_day_min"    integer,
        "meals_per_day_max"    integer,
        "meal_instruction"     TEXT,
        "volume_per_meal_min"  integer,
        "volume_per_meal_max"  integer,
        "volume_instruction"   TEXT,
        "recommended_foods"    TEXT[]                   NOT NULL DEFAULT '{}',
        "recommended_drinks"   TEXT[]                   NOT NULL DEFAULT '{}',
        "updated_by"           integer,
        "updated_at"           TIMESTAMP,
        "created_at"           TIMESTAMP                NOT NULL DEFAULT now(),
        CONSTRAINT "PK_pod_protocols_pod_id" PRIMARY KEY ("pod_id")
      )
    `);

    // ── Relationships ───────────────────────────────────────────────────────────
    await queryRunner.query(`
      ALTER TABLE ${schema}."pod_protocols"
      ADD CONSTRAINT "FK_pod_protocols_operation_type_id"
      FOREIGN KEY ("operation_type_id") REFERENCES ${schema}."operation_types"("operation_type_id") ON DELETE RESTRICT ON UPDATE NO ACTION
    `);
    await queryRunner.query(`
      ALTER TABLE ${schema}."pod_protocols"
      ADD CONSTRAINT "FK_pod_protocols_updated_by"
      FOREIGN KEY ("updated_by") REFERENCES ${schema}."users"("user_id") ON DELETE SET NULL ON UPDATE NO ACTION
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const schemaName = process.env.DB_SCHEMA ?? 'public';
    const schema = `"${schemaName}"`;

    await queryRunner.query(`ALTER TABLE ${schema}."pod_protocols" DROP CONSTRAINT IF EXISTS "FK_pod_protocols_updated_by"`);
    await queryRunner.query(`ALTER TABLE ${schema}."pod_protocols" DROP CONSTRAINT IF EXISTS "FK_pod_protocols_operation_type_id"`);
    await queryRunner.query(`DROP TABLE IF EXISTS ${schema}."pod_protocols"`);
  }
}
