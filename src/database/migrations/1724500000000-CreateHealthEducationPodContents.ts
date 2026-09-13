import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateHealthEducationPodContents1724500000000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE "health_education_pod_contents" (
                "content_id" SERIAL PRIMARY KEY,
                "pod_day" SMALLINT NOT NULL,
                "operation_type_id" INT NULL,
                "goals" JSONB NOT NULL DEFAULT '[]',
                "actions" JSONB NOT NULL DEFAULT '[]',
                "warning_signs" JSONB NOT NULL DEFAULT '[]',
                "note" TEXT NULL,
                "is_active" BOOLEAN NOT NULL DEFAULT TRUE,
                "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE "health_education_pod_contents"`);
    }
}
