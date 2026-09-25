import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreatePatientNotificationsTable1790300000000 implements MigrationInterface {
  name = 'CreatePatientNotificationsTable1790300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const schema = `"${process.env.DB_SCHEMA ?? 'public'}"`;

    await queryRunner.query(`
      CREATE TABLE ${schema}."patient_notifications" (
        "notification_id" SERIAL PRIMARY KEY,
        "case_id" VARCHAR NOT NULL,
        "title" VARCHAR(200) NOT NULL,
        "body" TEXT NOT NULL,
        "category" VARCHAR(20) NOT NULL DEFAULT 'medical',
        "route" VARCHAR(50),
        "is_read" BOOLEAN NOT NULL DEFAULT false,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "FK_patient_notifications_case_id" FOREIGN KEY ("case_id")
          REFERENCES ${schema}."patient_cases"("case_id") ON DELETE CASCADE ON UPDATE NO ACTION
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_patient_notifications_case_created"
      ON ${schema}."patient_notifications" ("case_id", "created_at" DESC)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const schema = `"${process.env.DB_SCHEMA ?? 'public'}"`;
    await queryRunner.query(
      `DROP INDEX ${schema}."IDX_patient_notifications_case_created"`,
    );
    await queryRunner.query(`DROP TABLE ${schema}."patient_notifications"`);
  }
}
