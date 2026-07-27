import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateUserDevicesTable1785000000000 implements MigrationInterface {
  name = 'CreateUserDevicesTable1785000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const schemaName = process.env.DB_SCHEMA ?? 'public';
    const schema = `"${schemaName}"`;

    await queryRunner.query(`
      CREATE TABLE ${schema}."user_devices" (
        "device_id" SERIAL NOT NULL,
        "user_id" integer NOT NULL,
        "installation_id" character varying(150) NOT NULL,
        "fcm_token" character varying(500) NOT NULL,
        "platform" character varying(20) NOT NULL,
        "app_version" character varying(50),
        "os_version" character varying(50),
        "device_model" character varying(100),
        "timezone" character varying(100),
        "is_active" BOOLEAN NOT NULL DEFAULT TRUE,
        "last_seen_at" TIMESTAMP,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_user_devices_device_id" PRIMARY KEY ("device_id"),
        CONSTRAINT "UQ_user_devices_installation_id" UNIQUE ("installation_id"),
        CONSTRAINT "UQ_user_devices_fcm_token" UNIQUE ("fcm_token")
      )
    `);

    await queryRunner.query(`CREATE INDEX "IDX_user_devices_user_id" ON ${schema}."user_devices" ("user_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_user_devices_is_active" ON ${schema}."user_devices" ("is_active")`);

    await queryRunner.query(`
      ALTER TABLE ${schema}."user_devices"
      ADD CONSTRAINT "FK_user_devices_user_id"
      FOREIGN KEY ("user_id") REFERENCES ${schema}."users"("user_id") ON DELETE CASCADE ON UPDATE NO ACTION
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const schemaName = process.env.DB_SCHEMA ?? 'public';
    const schema = `"${schemaName}"`;

    await queryRunner.query(`ALTER TABLE ${schema}."user_devices" DROP CONSTRAINT "FK_user_devices_user_id"`);
    await queryRunner.query(`DROP INDEX ${schema}."IDX_user_devices_is_active"`);
    await queryRunner.query(`DROP INDEX ${schema}."IDX_user_devices_user_id"`);
    await queryRunner.query(`DROP TABLE ${schema}."user_devices"`);
  }
}