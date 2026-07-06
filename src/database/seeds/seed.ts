import * as bcrypt from 'bcrypt';
import 'dotenv/config';
import { DataSource } from 'typeorm';

const SCHEMA = process.env.DB_SCHEMA || 'public';
const SALT_ROUNDS = 10;

const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: +(process.env.DB_PORT || 5432),
  username: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_NAME || 'SEP490_G57',
  schema: SCHEMA,
});

async function seed() {
  await AppDataSource.initialize();
  console.log('🌱 Seeding database...');

  const schema = `"${SCHEMA}"`;

  const roles = ['Admin', 'Head_Nurse', 'Nurse', 'Patient'];
  for (const roleName of roles) {
    await AppDataSource.query(
      `
      INSERT INTO ${schema}."roles" ("role_name")
      VALUES ($1)
      ON CONFLICT ("role_name") DO NOTHING
    `,
      [roleName],
    );
  }
  console.log('✅ Roles seeded');

  const users = [
    {
      username: 'admin',
      password: 'Admin@123',
      fullName: 'Quản trị viên',
      role: 'Admin',
      caseId: null,
    },
    {
      username: 'head_nurse',
      password: 'Nurse@123',
      fullName: 'Điều dưỡng trưởng',
      role: 'Head_Nurse',
      caseId: null,
    },
    {
      username: 'nurse01',
      password: 'Nurse@123',
      fullName: 'Điều dưỡng 01',
      role: 'Nurse',
      caseId: null,
    },
    {
      username: 'patient01',
      password: 'Patient@123',
      fullName: 'Bệnh nhân 01',
      role: 'Patient',
      caseId: 'CASE-001',
    },
  ];

  for (const u of users) {
    const hash = await bcrypt.hash(u.password, SALT_ROUNDS);

    const result = await AppDataSource.query(
      `
      INSERT INTO ${schema}."users" ("username", "password_hash", "full_name", "is_active", "case_id")
      VALUES ($1, $2, $3, TRUE, $4)
      ON CONFLICT ("username") DO UPDATE SET "case_id" = EXCLUDED."case_id"
      RETURNING "user_id"
    `,
      [u.username, hash, u.fullName, u.caseId],
    );

    if (result.length === 0) {
      console.log(`⏭️  User "${u.username}" skipped`);
      continue;
    }

    const userId = result[0].user_id;

    // Link role
    const roleResult = await AppDataSource.query(
      `
      SELECT "role_id" FROM ${schema}."roles" WHERE "role_name" = $1
    `,
      [u.role],
    );

    if (roleResult.length > 0) {
      const roleId = roleResult[0].role_id;
      await AppDataSource.query(
        `
        INSERT INTO ${schema}."user_roles" ("user_id", "role_id")
        VALUES ($1, $2)
        ON CONFLICT DO NOTHING
      `,
        [userId, roleId],
      );
    }

    console.log(`✅ User "${u.username}" (${u.role}) seeded`);
  }

  const nurseResult = await AppDataSource.query(`
    SELECT "user_id" FROM ${schema}."users" WHERE "username" = 'nurse01'
  `);
  const nurseId = nurseResult[0]?.user_id ?? null;

  const operationResult = await AppDataSource.query(
    `
    INSERT INTO ${schema}."operation_types" ("operation_name")
    VALUES ($1), ($2)
    ON CONFLICT ("operation_name") DO UPDATE SET "operation_name" = EXCLUDED."operation_name"
    RETURNING "operation_type_id", "operation_name"
  `,
    ['Phẫu thuật dạ dày', 'Phẫu thuật đại trực tràng'],
  );
  const operationTypeByName: Record<string, number> = Object.fromEntries(
    operationResult.map((o: { operation_type_id: number; operation_name: string }) => [
      o.operation_name,
      o.operation_type_id,
    ]),
  );
  console.log('✅ Operation types seeded: Phẫu thuật dạ dày, Phẫu thuật đại trực tràng');

  await AppDataSource.query(
    `
    INSERT INTO ${schema}."patient_cases" (
      "case_id", "name_initials", "age", "gender",
      "diagnosis", "operation_type_id", "method",
      "surgery_date", "room_bed", "current_pod",
      "assigned_nurse_id"
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
    ON CONFLICT ("case_id") DO NOTHING
  `,
    [
      'CASE-001',
      'N.V.A',
      55,
      'Nam',
      'Ung thư đại tràng giai đoạn II',
      operationTypeByName['Phẫu thuật đại trực tràng'],
      'Nội soi',
      '2026-06-10',
      'P101-B1',
      2,
      nurseId,
    ],
  );
  console.log('✅ Sample patient case CASE-001 seeded');

  await AppDataSource.destroy();
  console.log('🎉 Seed completed!');
}

seed().catch((err) => {
  console.error('❌ Seed failed:', err);
  process.exit(1);
});
