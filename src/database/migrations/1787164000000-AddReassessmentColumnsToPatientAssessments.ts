import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddReassessmentColumnsToPatientAssessments1787164000000
  implements MigrationInterface
{
  name = 'AddReassessmentColumnsToPatientAssessments1787164000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE patient_assessments ADD COLUMN IF NOT EXISTS source VARCHAR(20) NOT NULL DEFAULT 'SURVEY'`);
    await queryRunner.query(`ALTER TABLE patient_assessments ADD COLUMN IF NOT EXISTS nurse_note TEXT NULL`);
    await queryRunner.query(`ALTER TABLE patient_assessments ADD COLUMN IF NOT EXISTS nurse_id INTEGER NULL`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS IDX_patient_assessments_case_source ON patient_assessments (case_id, source, evaluation_datetime DESC)`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS IDX_patient_assessments_case_source`);
    await queryRunner.query(`ALTER TABLE patient_assessments DROP COLUMN IF EXISTS nurse_id`);
    await queryRunner.query(`ALTER TABLE patient_assessments DROP COLUMN IF EXISTS nurse_note`);
    await queryRunner.query(`ALTER TABLE patient_assessments DROP COLUMN IF EXISTS source`);
  }
}
