import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds the `Doctor` role (role_id 5) to existing databases.
 *
 * `seed.ts` already inserts it when a database is seeded from scratch; this
 * migration covers real/long-lived databases that are never re-seeded. Ids 1-4
 * (Admin / Head_Nurse / Nurse / Patient) are left untouched — the seed script
 * references them positionally.
 */
export class AddDoctorRole1789000000000 implements MigrationInterface {
  name = 'AddDoctorRole1789000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const schemaName = process.env.DB_SCHEMA ?? 'public';
    const schema = `"${schemaName}"`;

    await queryRunner.query(`
      INSERT INTO ${schema}."roles" ("role_id", "role_name", "description")
      VALUES (5, 'Doctor', 'Bác sĩ điều trị')
      ON CONFLICT ("role_name") DO NOTHING
    `);

    // Keep the SERIAL sequence ahead of the explicitly inserted id.
    await queryRunner.query(`
      SELECT setval(
        pg_get_serial_sequence('${schemaName}.roles', 'role_id'),
        GREATEST((SELECT COALESCE(MAX("role_id"), 1) FROM ${schema}."roles"), 1)
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const schemaName = process.env.DB_SCHEMA ?? 'public';
    const schema = `"${schemaName}"`;

    await queryRunner.query(`
      DELETE FROM ${schema}."user_roles"
      WHERE "role_id" IN (SELECT "role_id" FROM ${schema}."roles" WHERE "role_name" = 'Doctor')
    `);
    await queryRunner.query(`DELETE FROM ${schema}."roles" WHERE "role_name" = 'Doctor'`);
  }
}
