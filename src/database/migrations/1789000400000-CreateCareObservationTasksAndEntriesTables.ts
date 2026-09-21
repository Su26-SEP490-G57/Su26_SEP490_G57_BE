import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Creates `care_observation_tasks` (the sheet currently assigned to a patient's
 * nursing workflow) and `care_observation_entries` (what a nurse fills in).
 *
 * The partial unique index `UQ_care_observation_tasks_one_open_per_case`
 * enforces the "exactly one open sheet per patient" invariant in the database,
 * not just in the service layer.
 */
export class CreateCareObservationTasksAndEntriesTables1789000400000 implements MigrationInterface {
  name = 'CreateCareObservationTasksAndEntriesTables1789000400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const schemaName = process.env.DB_SCHEMA ?? 'public';
    const schema = `"${schemaName}"`;

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS ${schema}."care_observation_tasks" (
        "task_id" SERIAL NOT NULL,
        "case_id" character varying NOT NULL,
        "template_id" integer NOT NULL,
        "treatment_order_id" integer,
        "care_level_at_assignment" ${schema}."care_level_enum" NOT NULL,
        "status" character varying(20) NOT NULL DEFAULT 'OPEN',
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "superseded_at" TIMESTAMP WITH TIME ZONE,
        CONSTRAINT "PK_care_observation_tasks_task_id" PRIMARY KEY ("task_id"),
        CONSTRAINT "CHK_care_observation_tasks_status"
          CHECK ("status" IN ('OPEN', 'SUPERSEDED', 'COMPLETED'))
      )
    `);

    await queryRunner.query(`
      ALTER TABLE ${schema}."care_observation_tasks"
      ADD CONSTRAINT "FK_care_observation_tasks_case"
      FOREIGN KEY ("case_id") REFERENCES ${schema}."patient_cases"("case_id")
      ON DELETE CASCADE ON UPDATE NO ACTION NOT VALID,
      ADD CONSTRAINT "FK_care_observation_tasks_template"
      FOREIGN KEY ("template_id")
      REFERENCES ${schema}."care_observation_sheet_templates"("template_id")
      ON DELETE RESTRICT ON UPDATE NO ACTION NOT VALID,
      ADD CONSTRAINT "FK_care_observation_tasks_treatment_order"
      FOREIGN KEY ("treatment_order_id")
      REFERENCES ${schema}."treatment_orders"("treatment_order_id")
      ON DELETE SET NULL ON UPDATE NO ACTION NOT VALID
    `);

    await queryRunner.query(`
      ALTER TABLE ${schema}."care_observation_tasks"
      VALIDATE CONSTRAINT "FK_care_observation_tasks_case"
    `);
    await queryRunner.query(`
      ALTER TABLE ${schema}."care_observation_tasks"
      VALIDATE CONSTRAINT "FK_care_observation_tasks_template"
    `);
    await queryRunner.query(`
      ALTER TABLE ${schema}."care_observation_tasks"
      VALIDATE CONSTRAINT "FK_care_observation_tasks_treatment_order"
    `);

    // One open sheet per patient — DB-enforced.
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_care_observation_tasks_one_open_per_case"
      ON ${schema}."care_observation_tasks" ("case_id")
      WHERE "status" = 'OPEN'
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS ${schema}."care_observation_entries" (
        "entry_id" SERIAL NOT NULL,
        "task_id" integer NOT NULL,
        "findings" JSONB NOT NULL DEFAULT '{}'::jsonb,
        "note" TEXT,
        "observed_by_user_id" integer,
        "observed_by_name" character varying(255) NOT NULL,
        "observed_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_care_observation_entries_entry_id" PRIMARY KEY ("entry_id")
      )
    `);

    await queryRunner.query(`
      ALTER TABLE ${schema}."care_observation_entries"
      ADD CONSTRAINT "FK_care_observation_entries_task"
      FOREIGN KEY ("task_id") REFERENCES ${schema}."care_observation_tasks"("task_id")
      ON DELETE CASCADE ON UPDATE NO ACTION NOT VALID,
      ADD CONSTRAINT "FK_care_observation_entries_observed_by"
      FOREIGN KEY ("observed_by_user_id") REFERENCES ${schema}."users"("user_id")
      ON DELETE SET NULL ON UPDATE NO ACTION NOT VALID
    `);

    await queryRunner.query(`
      ALTER TABLE ${schema}."care_observation_entries"
      VALIDATE CONSTRAINT "FK_care_observation_entries_task"
    `);
    await queryRunner.query(`
      ALTER TABLE ${schema}."care_observation_entries"
      VALIDATE CONSTRAINT "FK_care_observation_entries_observed_by"
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_care_observation_entries_task_observed_at"
      ON ${schema}."care_observation_entries" ("task_id", "observed_at" DESC)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const schemaName = process.env.DB_SCHEMA ?? 'public';
    const schema = `"${schemaName}"`;

    await queryRunner.query(
      `DROP INDEX IF EXISTS ${schema}."IDX_care_observation_entries_task_observed_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE IF EXISTS ${schema}."care_observation_entries" DROP CONSTRAINT IF EXISTS "FK_care_observation_entries_observed_by"`,
    );
    await queryRunner.query(
      `ALTER TABLE IF EXISTS ${schema}."care_observation_entries" DROP CONSTRAINT IF EXISTS "FK_care_observation_entries_task"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS ${schema}."care_observation_entries"`);

    await queryRunner.query(
      `DROP INDEX IF EXISTS ${schema}."UQ_care_observation_tasks_one_open_per_case"`,
    );
    await queryRunner.query(
      `ALTER TABLE IF EXISTS ${schema}."care_observation_tasks" DROP CONSTRAINT IF EXISTS "FK_care_observation_tasks_treatment_order"`,
    );
    await queryRunner.query(
      `ALTER TABLE IF EXISTS ${schema}."care_observation_tasks" DROP CONSTRAINT IF EXISTS "FK_care_observation_tasks_template"`,
    );
    await queryRunner.query(
      `ALTER TABLE IF EXISTS ${schema}."care_observation_tasks" DROP CONSTRAINT IF EXISTS "FK_care_observation_tasks_case"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS ${schema}."care_observation_tasks"`);
  }
}
