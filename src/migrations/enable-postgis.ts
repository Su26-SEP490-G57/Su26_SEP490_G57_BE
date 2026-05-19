import { MigrationInterface, QueryRunner } from 'typeorm';

export class EnablePostgis implements MigrationInterface {
    name = 'EnablePostgis';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS postgis`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP EXTENSION IF EXISTS postgis`);
    }
}
