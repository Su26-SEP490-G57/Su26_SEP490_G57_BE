import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateAuditLogsTable1727187349285 implements MigrationInterface {
  name = 'CreateAuditLogsTable1727187349285';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "audit_logs" (
        "id" SERIAL PRIMARY KEY,
        "user_id" INT NOT NULL,
        "action" VARCHAR(50) NOT NULL,
        "entity_type" VARCHAR(100) NOT NULL,
        "entity_id" VARCHAR(255) NOT NULL,
        "changes" JSONB,
        "ip_address" VARCHAR(45),
        "user_agent" TEXT,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        CONSTRAINT "FK_audit_logs_user_id" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE CASCADE ON UPDATE NO ACTION
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_audit_logs_user_id" ON "audit_logs" ("user_id")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_audit_logs_entity" ON "audit_logs" ("entity_type", "entity_id")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_audit_logs_created_at" ON "audit_logs" ("created_at")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_audit_logs_created_at"`);
    await queryRunner.query(`DROP INDEX "IDX_audit_logs_entity"`);
    await queryRunner.query(`DROP INDEX "IDX_audit_logs_user_id"`);
    await queryRunner.query(`DROP TABLE "audit_logs"`);
  }
}
