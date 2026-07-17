import { MigrationInterface, QueryRunner } from "typeorm";

export class RenameColumnCamelCase1784261151565 implements MigrationInterface {
    name = 'RenameColumnCamelCase1784261151565'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "patient_cases" DROP CONSTRAINT "FK_patient_cases_assigned_nurse_id"`);
        await queryRunner.query(`ALTER TABLE "patient_cases" DROP CONSTRAINT "FK_patient_cases_level_id"`);
        await queryRunner.query(`ALTER TABLE "patient_cases" DROP CONSTRAINT "FK_patient_cases_operation_type_id"`);
        await queryRunner.query(`ALTER TABLE "question_options" DROP CONSTRAINT "FK_question_options_question_id"`);
        await queryRunner.query(`ALTER TABLE "patient_assessment_details" DROP CONSTRAINT "FK_patient_assessment_details_assessment_id"`);
        await queryRunner.query(`ALTER TABLE "patient_assessment_details" DROP CONSTRAINT "FK_patient_assessment_details_question_id"`);
        await queryRunner.query(`ALTER TABLE "patient_assessment_details" DROP CONSTRAINT "FK_patient_assessment_details_selected_option_id"`);
        await queryRunner.query(`ALTER TABLE "patient_assessments" DROP CONSTRAINT "FK_patient_assessments_case_id"`);
        await queryRunner.query(`ALTER TABLE "pod_protocols" DROP CONSTRAINT "FK_pod_protocols_operation_type_id"`);
        await queryRunner.query(`ALTER TABLE "pod_protocols" DROP CONSTRAINT "FK_pod_protocols_updated_by"`);
        await queryRunner.query(`ALTER TABLE "refresh_tokens" DROP CONSTRAINT "FK_refresh_tokens_user_id"`);
        await queryRunner.query(`ALTER TABLE "monitoring_alerts" DROP CONSTRAINT "FK_monitoring_alerts_case_id"`);
        await queryRunner.query(`ALTER TABLE "monitoring_alerts" DROP CONSTRAINT "FK_monitoring_alerts_assessment_id"`);
        await queryRunner.query(`ALTER TABLE "role_permissions" DROP CONSTRAINT "FK_role_permissions_role_id"`);
        await queryRunner.query(`ALTER TABLE "role_permissions" DROP CONSTRAINT "FK_role_permissions_permission_id"`);
        await queryRunner.query(`ALTER TABLE "user_roles" DROP CONSTRAINT "FK_user_roles_user_id"`);
        await queryRunner.query(`ALTER TABLE "user_roles" DROP CONSTRAINT "FK_user_roles_role_id"`);
        await queryRunner.query(`DROP INDEX "public"."idx_patient_cases_pod_sync"`);
        await queryRunner.query(`ALTER TABLE "levels" DROP CONSTRAINT "UQ_levels_level_name"`);
        await queryRunner.query(`ALTER TABLE "operation_types" DROP CONSTRAINT "UQ_operation_types_operation_name"`);
        await queryRunner.query(`ALTER TABLE "patient_cases" DROP COLUMN "pod_end_date"`);
        await queryRunner.query(`ALTER TABLE "patient_cases" ADD "pod_end_date" TIMESTAMP WITH TIME ZONE`);
        await queryRunner.query(`ALTER TABLE "pod_protocols" ALTER COLUMN "updated_at" SET DEFAULT now()`);
        await queryRunner.query(`ALTER TABLE "monitoring_alerts" DROP COLUMN "alert_type"`);
        await queryRunner.query(`DROP TYPE "public"."alerts_alert_type_enum"`);
        await queryRunner.query(`ALTER TABLE "monitoring_alerts" ADD "alert_type" character varying(10) NOT NULL`);
        await queryRunner.query(`CREATE INDEX "IDX_17022daf3f885f7d35423e9971" ON "role_permissions" ("permission_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_178199805b901ccd220ab7740e" ON "role_permissions" ("role_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_87b8888186ca9769c960e92687" ON "user_roles" ("user_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_b23c65e50a758245a33ee35fda" ON "user_roles" ("role_id") `);
        await queryRunner.query(`ALTER TABLE "patient_cases" ADD CONSTRAINT "FK_26791b2915e60b78955df46a46b" FOREIGN KEY ("operation_type_id") REFERENCES "operation_types"("operation_type_id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "patient_cases" ADD CONSTRAINT "FK_564e16562745e58568bff6bbf84" FOREIGN KEY ("assigned_nurse_id") REFERENCES "users"("user_id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "patient_cases" ADD CONSTRAINT "FK_1adc6971e2aa283295d56e0278f" FOREIGN KEY ("level_id") REFERENCES "levels"("level_id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "question_options" ADD CONSTRAINT "FK_f0b7aaabd3f88e700daf0fe681c" FOREIGN KEY ("question_id") REFERENCES "survey_questions"("question_id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "patient_assessment_details" ADD CONSTRAINT "FK_16a37f6669aab521dea19acddd7" FOREIGN KEY ("assessment_id") REFERENCES "patient_assessments"("assessment_id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "patient_assessment_details" ADD CONSTRAINT "FK_35a9385c0134f282b7f01521af1" FOREIGN KEY ("question_id") REFERENCES "survey_questions"("question_id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "patient_assessment_details" ADD CONSTRAINT "FK_43de77f7c4d3648974da8058bec" FOREIGN KEY ("selected_option_id") REFERENCES "question_options"("option_id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "patient_assessments" ADD CONSTRAINT "FK_c1402da90bece37d4445611bffd" FOREIGN KEY ("case_id") REFERENCES "patient_cases"("case_id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "pod_protocols" ADD CONSTRAINT "FK_d5a013f726d32f46601250c110e" FOREIGN KEY ("operation_type_id") REFERENCES "operation_types"("operation_type_id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "pod_protocols" ADD CONSTRAINT "FK_1d8d357da1c265067f5f09d7e0f" FOREIGN KEY ("updated_by") REFERENCES "users"("user_id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "refresh_tokens" ADD CONSTRAINT "FK_3ddc983c5f7bcf132fd8732c3f4" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "monitoring_alerts" ADD CONSTRAINT "FK_1f892acd05b1791df87cbce6820" FOREIGN KEY ("case_id") REFERENCES "patient_cases"("case_id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "monitoring_alerts" ADD CONSTRAINT "FK_cc2040818e2d486da20aaece749" FOREIGN KEY ("assessment_id") REFERENCES "patient_assessments"("assessment_id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "role_permissions" ADD CONSTRAINT "FK_17022daf3f885f7d35423e9971e" FOREIGN KEY ("permission_id") REFERENCES "permissions"("permission_id") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "role_permissions" ADD CONSTRAINT "FK_178199805b901ccd220ab7740ec" FOREIGN KEY ("role_id") REFERENCES "roles"("role_id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "user_roles" ADD CONSTRAINT "FK_87b8888186ca9769c960e926870" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "user_roles" ADD CONSTRAINT "FK_b23c65e50a758245a33ee35fda1" FOREIGN KEY ("role_id") REFERENCES "roles"("role_id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "user_roles" DROP CONSTRAINT "FK_b23c65e50a758245a33ee35fda1"`);
        await queryRunner.query(`ALTER TABLE "user_roles" DROP CONSTRAINT "FK_87b8888186ca9769c960e926870"`);
        await queryRunner.query(`ALTER TABLE "role_permissions" DROP CONSTRAINT "FK_178199805b901ccd220ab7740ec"`);
        await queryRunner.query(`ALTER TABLE "role_permissions" DROP CONSTRAINT "FK_17022daf3f885f7d35423e9971e"`);
        await queryRunner.query(`ALTER TABLE "monitoring_alerts" DROP CONSTRAINT "FK_cc2040818e2d486da20aaece749"`);
        await queryRunner.query(`ALTER TABLE "monitoring_alerts" DROP CONSTRAINT "FK_1f892acd05b1791df87cbce6820"`);
        await queryRunner.query(`ALTER TABLE "refresh_tokens" DROP CONSTRAINT "FK_3ddc983c5f7bcf132fd8732c3f4"`);
        await queryRunner.query(`ALTER TABLE "pod_protocols" DROP CONSTRAINT "FK_1d8d357da1c265067f5f09d7e0f"`);
        await queryRunner.query(`ALTER TABLE "pod_protocols" DROP CONSTRAINT "FK_d5a013f726d32f46601250c110e"`);
        await queryRunner.query(`ALTER TABLE "patient_assessments" DROP CONSTRAINT "FK_c1402da90bece37d4445611bffd"`);
        await queryRunner.query(`ALTER TABLE "patient_assessment_details" DROP CONSTRAINT "FK_43de77f7c4d3648974da8058bec"`);
        await queryRunner.query(`ALTER TABLE "patient_assessment_details" DROP CONSTRAINT "FK_35a9385c0134f282b7f01521af1"`);
        await queryRunner.query(`ALTER TABLE "patient_assessment_details" DROP CONSTRAINT "FK_16a37f6669aab521dea19acddd7"`);
        await queryRunner.query(`ALTER TABLE "question_options" DROP CONSTRAINT "FK_f0b7aaabd3f88e700daf0fe681c"`);
        await queryRunner.query(`ALTER TABLE "patient_cases" DROP CONSTRAINT "FK_1adc6971e2aa283295d56e0278f"`);
        await queryRunner.query(`ALTER TABLE "patient_cases" DROP CONSTRAINT "FK_564e16562745e58568bff6bbf84"`);
        await queryRunner.query(`ALTER TABLE "patient_cases" DROP CONSTRAINT "FK_26791b2915e60b78955df46a46b"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_b23c65e50a758245a33ee35fda"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_87b8888186ca9769c960e92687"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_178199805b901ccd220ab7740e"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_17022daf3f885f7d35423e9971"`);
        await queryRunner.query(`ALTER TABLE "monitoring_alerts" DROP COLUMN "alert_type"`);
        await queryRunner.query(`CREATE TYPE "public"."alerts_alert_type_enum" AS ENUM('YELLOW', 'RED')`);
        await queryRunner.query(`ALTER TABLE "monitoring_alerts" ADD "alert_type" "public"."alerts_alert_type_enum" NOT NULL`);
        await queryRunner.query(`ALTER TABLE "pod_protocols" ALTER COLUMN "updated_at" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "patient_cases" DROP COLUMN "pod_end_date"`);
        await queryRunner.query(`ALTER TABLE "patient_cases" ADD "pod_end_date" date`);
        await queryRunner.query(`ALTER TABLE "operation_types" ADD CONSTRAINT "UQ_operation_types_operation_name" UNIQUE ("operation_name")`);
        await queryRunner.query(`ALTER TABLE "levels" ADD CONSTRAINT "UQ_levels_level_name" UNIQUE ("level_name")`);
        await queryRunner.query(`CREATE INDEX "idx_patient_cases_pod_sync" ON "patient_cases" ("current_pod", "pod_start_date") WHERE ((is_locked = false) AND (deleted_at IS NULL) AND (pod_start_date IS NOT NULL))`);
        await queryRunner.query(`ALTER TABLE "user_roles" ADD CONSTRAINT "FK_user_roles_role_id" FOREIGN KEY ("role_id") REFERENCES "roles"("role_id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "user_roles" ADD CONSTRAINT "FK_user_roles_user_id" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "role_permissions" ADD CONSTRAINT "FK_role_permissions_permission_id" FOREIGN KEY ("permission_id") REFERENCES "permissions"("permission_id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "role_permissions" ADD CONSTRAINT "FK_role_permissions_role_id" FOREIGN KEY ("role_id") REFERENCES "roles"("role_id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "monitoring_alerts" ADD CONSTRAINT "FK_monitoring_alerts_assessment_id" FOREIGN KEY ("assessment_id") REFERENCES "patient_assessments"("assessment_id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "monitoring_alerts" ADD CONSTRAINT "FK_monitoring_alerts_case_id" FOREIGN KEY ("case_id") REFERENCES "patient_cases"("case_id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "refresh_tokens" ADD CONSTRAINT "FK_refresh_tokens_user_id" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "pod_protocols" ADD CONSTRAINT "FK_pod_protocols_updated_by" FOREIGN KEY ("updated_by") REFERENCES "users"("user_id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "pod_protocols" ADD CONSTRAINT "FK_pod_protocols_operation_type_id" FOREIGN KEY ("operation_type_id") REFERENCES "operation_types"("operation_type_id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "patient_assessments" ADD CONSTRAINT "FK_patient_assessments_case_id" FOREIGN KEY ("case_id") REFERENCES "patient_cases"("case_id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "patient_assessment_details" ADD CONSTRAINT "FK_patient_assessment_details_selected_option_id" FOREIGN KEY ("selected_option_id") REFERENCES "question_options"("option_id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "patient_assessment_details" ADD CONSTRAINT "FK_patient_assessment_details_question_id" FOREIGN KEY ("question_id") REFERENCES "survey_questions"("question_id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "patient_assessment_details" ADD CONSTRAINT "FK_patient_assessment_details_assessment_id" FOREIGN KEY ("assessment_id") REFERENCES "patient_assessments"("assessment_id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "question_options" ADD CONSTRAINT "FK_question_options_question_id" FOREIGN KEY ("question_id") REFERENCES "survey_questions"("question_id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "patient_cases" ADD CONSTRAINT "FK_patient_cases_operation_type_id" FOREIGN KEY ("operation_type_id") REFERENCES "operation_types"("operation_type_id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "patient_cases" ADD CONSTRAINT "FK_patient_cases_level_id" FOREIGN KEY ("level_id") REFERENCES "levels"("level_id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "patient_cases" ADD CONSTRAINT "FK_patient_cases_assigned_nurse_id" FOREIGN KEY ("assigned_nurse_id") REFERENCES "users"("user_id") ON DELETE SET NULL ON UPDATE NO ACTION`);
    }

}
