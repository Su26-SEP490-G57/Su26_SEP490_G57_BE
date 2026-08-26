import { MigrationInterface, QueryRunner } from "typeorm";

export class FinalRemoveScoreFields1787589006516 implements MigrationInterface {
    name = 'FinalRemoveScoreFields1787589006516'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "assessment_tasks" DROP CONSTRAINT "FK_62f209f47c090dd5fa4af064485"`);
        await queryRunner.query(`ALTER TABLE "assessment_tasks" DROP CONSTRAINT "FK_a082a53040340df8b9b8882d8d7"`);
        await queryRunner.query(`ALTER TABLE "room_nurse_assignments" DROP CONSTRAINT "FK_7f9df6833ce4a7be9abe923d945"`);
        await queryRunner.query(`ALTER TABLE "patient_assessments" RENAME COLUMN "total_score" TO "triage_verdict_snapshot"`);
        await queryRunner.query(`ALTER TABLE "question_options" DROP COLUMN "score_value"`);
        await queryRunner.query(`ALTER TABLE "patient_assessment_details" DROP COLUMN "score_earned"`);
        await queryRunner.query(`ALTER TABLE "assessment_tasks" DROP COLUMN "missed_at"`);
        await queryRunner.query(`ALTER TABLE "assessment_tasks" ADD "missed_at" TIMESTAMP WITH TIME ZONE`);
        await queryRunner.query(`ALTER TABLE "patient_assessments" DROP COLUMN "triage_verdict_snapshot"`);
        await queryRunner.query(`ALTER TABLE "patient_assessments" ADD "triage_verdict_snapshot" character varying(20)`);
        await queryRunner.query(`ALTER TABLE "assessment_tasks" ADD CONSTRAINT "UQ_62f209f47c090dd5fa4af064485" UNIQUE ("assessment_id")`);
        await queryRunner.query(`ALTER TABLE "assessment_tasks" ADD CONSTRAINT "FK_a082a53040340df8b9b8882d8d7" FOREIGN KEY ("case_id") REFERENCES "patient_cases"("case_id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "assessment_tasks" ADD CONSTRAINT "FK_62f209f47c090dd5fa4af064485" FOREIGN KEY ("assessment_id") REFERENCES "patient_assessments"("assessment_id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "room_nurse_assignments" ADD CONSTRAINT "FK_7f9df6833ce4a7be9abe923d945" FOREIGN KEY ("nurse_user_id") REFERENCES "users"("user_id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "room_nurse_assignments" DROP CONSTRAINT "FK_7f9df6833ce4a7be9abe923d945"`);
        await queryRunner.query(`ALTER TABLE "assessment_tasks" DROP CONSTRAINT "FK_62f209f47c090dd5fa4af064485"`);
        await queryRunner.query(`ALTER TABLE "assessment_tasks" DROP CONSTRAINT "FK_a082a53040340df8b9b8882d8d7"`);
        await queryRunner.query(`ALTER TABLE "assessment_tasks" DROP CONSTRAINT "UQ_62f209f47c090dd5fa4af064485"`);
        await queryRunner.query(`ALTER TABLE "patient_assessments" DROP COLUMN "triage_verdict_snapshot"`);
        await queryRunner.query(`ALTER TABLE "patient_assessments" ADD "triage_verdict_snapshot" integer NOT NULL DEFAULT '0'`);
        await queryRunner.query(`ALTER TABLE "assessment_tasks" DROP COLUMN "missed_at"`);
        await queryRunner.query(`ALTER TABLE "assessment_tasks" ADD "missed_at" TIMESTAMP WITH TIME ZONE`);
        await queryRunner.query(`ALTER TABLE "patient_assessment_details" ADD "score_earned" integer NOT NULL`);
        await queryRunner.query(`ALTER TABLE "question_options" ADD "score_value" integer NOT NULL`);
        await queryRunner.query(`ALTER TABLE "patient_assessments" RENAME COLUMN "triage_verdict_snapshot" TO "total_score"`);
        await queryRunner.query(`ALTER TABLE "room_nurse_assignments" ADD CONSTRAINT "FK_7f9df6833ce4a7be9abe923d945" FOREIGN KEY ("nurse_user_id") REFERENCES "users"("user_id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "assessment_tasks" ADD CONSTRAINT "FK_a082a53040340df8b9b8882d8d7" FOREIGN KEY ("case_id") REFERENCES "patient_cases"("case_id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "assessment_tasks" ADD CONSTRAINT "FK_62f209f47c090dd5fa4af064485" FOREIGN KEY ("assessment_id") REFERENCES "patient_assessments"("assessment_id") ON DELETE SET NULL ON UPDATE NO ACTION`);
    }

}
