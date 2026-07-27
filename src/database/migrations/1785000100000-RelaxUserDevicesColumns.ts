import { MigrationInterface, QueryRunner } from 'typeorm';

export class RelaxUserDevicesColumns1785000100000 implements MigrationInterface {
  name = 'RelaxUserDevicesColumns1785000100000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const schemaName = process.env.DB_SCHEMA ?? 'public';
    const schema = `"${schemaName}"`;

    await queryRunner.query(`ALTER TABLE ${schema}."user_devices" ALTER COLUMN "installation_id" DROP NOT NULL`);
    await queryRunner.query(`ALTER TABLE ${schema}."user_devices" ALTER COLUMN "platform" DROP NOT NULL`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const schemaName = process.env.DB_SCHEMA ?? 'public';
    const schema = `"${schemaName}"`;

    await queryRunner.query(`ALTER TABLE ${schema}."user_devices" ALTER COLUMN "platform" SET NOT NULL`);
    await queryRunner.query(`ALTER TABLE ${schema}."user_devices" ALTER COLUMN "installation_id" SET NOT NULL`);
  }
}