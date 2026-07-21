import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Enable the `unaccent` extension so patient search can be diacritics-insensitive
 * (e.g. searching "nguyen" matches "Nguyễn"). Installed into the public schema so
 * the unqualified unaccent() function resolves on the default search_path.
 */
export class EnableUnaccentExtension1781900500000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS unaccent WITH SCHEMA public`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP EXTENSION IF EXISTS unaccent`);
  }
}
