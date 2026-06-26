import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUserDemographicFields1781625500000 implements MigrationInterface {
  name = 'AddUserDemographicFields1781625500000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const schemaName = process.env.DB_SCHEMA ?? 'public';
    const schema = `"${schemaName}"`;

    // ── Optional demographic / address fields on user accounts ──────────────────
    await queryRunner.query(`ALTER TABLE ${schema}."users" ADD COLUMN IF NOT EXISTS "dob" DATE`);
    await queryRunner.query(`ALTER TABLE ${schema}."users" ADD COLUMN IF NOT EXISTS "city_province" character varying(100)`);
    await queryRunner.query(`ALTER TABLE ${schema}."users" ADD COLUMN IF NOT EXISTS "ward" character varying(100)`);
    await queryRunner.query(`ALTER TABLE ${schema}."users" ADD COLUMN IF NOT EXISTS "detailed_address" character varying(255)`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const schemaName = process.env.DB_SCHEMA ?? 'public';
    const schema = `"${schemaName}"`;

    await queryRunner.query(`ALTER TABLE ${schema}."users" DROP COLUMN IF EXISTS "detailed_address"`);
    await queryRunner.query(`ALTER TABLE ${schema}."users" DROP COLUMN IF EXISTS "ward"`);
    await queryRunner.query(`ALTER TABLE ${schema}."users" DROP COLUMN IF EXISTS "city_province"`);
    await queryRunner.query(`ALTER TABLE ${schema}."users" DROP COLUMN IF EXISTS "dob"`);
  }
}
