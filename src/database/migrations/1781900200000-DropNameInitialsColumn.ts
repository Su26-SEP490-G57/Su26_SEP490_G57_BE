import { MigrationInterface, QueryRunner } from 'typeorm';

export class DropNameInitialsColumn1781900200000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "patient_cases"
      DROP COLUMN IF EXISTS "name_initials"
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "patient_cases"
      ADD COLUMN "name_initials" VARCHAR(50)
    `);
  }
}
