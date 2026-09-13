import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateCaseIdSequence1787900000000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE SEQUENCE "case_id_seq" START WITH 11`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP SEQUENCE "case_id_seq"`);
    }
}
