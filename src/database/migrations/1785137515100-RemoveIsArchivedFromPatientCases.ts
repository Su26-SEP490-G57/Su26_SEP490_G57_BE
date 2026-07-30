import { MigrationInterface, QueryRunner } from "typeorm";

export class RemoveIsArchivedFromPatientCases1785137515100 implements MigrationInterface {
    name = 'RemoveIsArchivedFromPatientCases1785137515100'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "pod_protocols" DROP CONSTRAINT "FK_d5a013f726d32f46601250c110e"`);
        await queryRunner.query(`ALTER TABLE "patient_cases" DROP COLUMN "is_archived"`);
        await queryRunner.query(`COMMENT ON COLUMN "patient_cases"."eras_completed" IS NULL`);
        await queryRunner.query(`ALTER TABLE "pod_protocols" ALTER COLUMN "updated_at" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "pod_protocols" ADD CONSTRAINT "FK_d5a013f726d32f46601250c110e" FOREIGN KEY ("operation_type_id") REFERENCES "operation_types"("operation_type_id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "pod_protocols" DROP CONSTRAINT "FK_d5a013f726d32f46601250c110e"`);
        await queryRunner.query(`ALTER TABLE "pod_protocols" ALTER COLUMN "updated_at" SET DEFAULT now()`);
        await queryRunner.query(`COMMENT ON COLUMN "patient_cases"."eras_completed" IS 'Indicates whether the patient has completed the ERAS protocol (reached max POD)'`);
        await queryRunner.query(`ALTER TABLE "patient_cases" ADD "is_archived" boolean NOT NULL DEFAULT false`);
        await queryRunner.query(`ALTER TABLE "pod_protocols" ADD CONSTRAINT "FK_d5a013f726d32f46601250c110e" FOREIGN KEY ("operation_type_id") REFERENCES "operation_types"("operation_type_id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
    }

}
