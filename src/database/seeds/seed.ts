/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import * as bcrypt from 'bcrypt';
import 'dotenv/config';
import AppDataSource from '../../data-source';

const SCHEMA = process.env.DB_SCHEMA || 'public';
const SALT_ROUNDS = 10;

async function seed() {
  console.log('🌱 [Seed] Initializing TypeORM DataSource...');

  await AppDataSource.initialize();

  const queryRunner = AppDataSource.createQueryRunner();
  await queryRunner.connect();

  console.log('🧹 [Seed] Wiping old data...');

  const PROTECTED_TABLES = ['survey_questions', 'question_options'];

  const entities = AppDataSource.entityMetadatas;
  await queryRunner.query('SET CONSTRAINTS ALL DEFERRED;');

  for (const entity of entities) {
    const tableName = entity.tableName;

    if (PROTECTED_TABLES.includes(tableName)) {
      console.log(`Skipping protected table: ${tableName}`);
      continue;
    }

    console.log(`   - Truncating table: ${tableName}`);
    await queryRunner.query(`TRUNCATE TABLE "${tableName}" RESTART IDENTITY CASCADE;`);
  }

  console.log('📥 [Seed] Inserting fresh standard dataset...');

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
    {
      username: 'patient02',
      password: 'Patient@123',
      fullName: 'Bệnh nhân 02',
      role: 'Patient',
      caseId: 'CASE-002',
    },
    {
      username: 'patient03',
      password: 'Patient@123',
      fullName: 'Bệnh nhân 03',
      role: 'Patient',
      caseId: 'CASE-003',
    },
    {
      username: 'patient04',
      password: 'Patient@123',
      fullName: 'Bệnh nhân 04',
      role: 'Patient',
      caseId: 'CASE-004',
    },
    {
      username: 'patient05',
      password: 'Patient@123',
      fullName: 'Bệnh nhân 05',
      role: 'Patient',
      caseId: 'CASE-005',
    },
    {
      username: 'patient06',
      password: 'Patient@123',
      fullName: 'Bệnh nhân 06',
      role: 'Patient',
      caseId: 'CASE-006',
    },
    {
      username: 'patient07',
      password: 'Patient@123',
      fullName: 'Bệnh nhân 07',
      role: 'Patient',
      caseId: 'CASE-007',
    },
    {
      username: 'patient08',
      password: 'Patient@123',
      fullName: 'Bệnh nhân 08',
      role: 'Patient',
      caseId: 'CASE-008',
    },
    {
      username: 'patient09',
      password: 'Patient@123',
      fullName: 'Bệnh nhân 09',
      role: 'Patient',
      caseId: 'CASE-009',
    },
    {
      username: 'patient10',
      password: 'Patient@123',
      fullName: 'Bệnh nhân 10',
      role: 'Patient',
      caseId: 'CASE-010',
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

  const patientCases = [
    {
      caseId: 'CASE-001',
      nameInitials: 'N.V.A',
      age: 55,
      gender: 'Nam',
      diagnosis: 'Ung thư đại tràng giai đoạn II',
      operationType: 'Phẫu thuật đại trực tràng',
      method: 'Nội soi',
      surgeryDate: '2026-06-10',
      roomBed: 'P101-B1',
      currentPod: 2,
    },
    // Phòng 503 - 2 người
    {
      caseId: 'CASE-002',
      nameInitials: 'T.T.B',
      age: 48,
      gender: 'Nữ',
      diagnosis: 'Ung thư dạ dày giai đoạn I',
      operationType: 'Phẫu thuật dạ dày',
      method: 'Mở',
      surgeryDate: '2026-07-01',
      roomBed: 'P503-B1',
      currentPod: 1,
    },
    {
      caseId: 'CASE-003',
      nameInitials: 'L.V.C',
      age: 62,
      gender: 'Nam',
      diagnosis: 'Polyp đại tràng',
      operationType: 'Phẫu thuật đại trực tràng',
      method: 'Nội soi',
      surgeryDate: '2026-07-05',
      roomBed: 'P503-B2',
      currentPod: 3,
    },
    // Phòng 504 - 4 người
    {
      caseId: 'CASE-004',
      nameInitials: 'P.T.D',
      age: 51,
      gender: 'Nữ',
      diagnosis: 'Viêm loét dạ dày mãn tính',
      operationType: 'Phẫu thuật dạ dày',
      method: 'Nội soi',
      surgeryDate: '2026-07-08',
      roomBed: 'P504-B1',
      currentPod: 2,
    },
    {
      caseId: 'CASE-005',
      nameInitials: 'H.M.E',
      age: 45,
      gender: 'Nam',
      diagnosis: 'Ung thư đại tràng giai đoạn III',
      operationType: 'Phẫu thuật đại trực tràng',
      method: 'Mở',
      surgeryDate: '2026-07-02',
      roomBed: 'P504-B2',
      currentPod: 4,
    },
    {
      caseId: 'CASE-006',
      nameInitials: 'D.T.F',
      age: 58,
      gender: 'Nữ',
      diagnosis: 'Khối u dạ dày lành tính',
      operationType: 'Phẫu thuật dạ dày',
      method: 'Nội soi',
      surgeryDate: '2026-07-10',
      roomBed: 'P504-B3',
      currentPod: 1,
    },
    {
      caseId: 'CASE-007',
      nameInitials: 'V.V.G',
      age: 67,
      gender: 'Nam',
      diagnosis: 'Ung thư trực tràng',
      operationType: 'Phẫu thuật đại trực tràng',
      method: 'Mở',
      surgeryDate: '2026-06-28',
      roomBed: 'P504-B4',
      currentPod: 5,
    },
    // Phòng 506 - 3 người
    {
      caseId: 'CASE-008',
      nameInitials: 'N.T.H',
      age: 43,
      gender: 'Nữ',
      diagnosis: 'Loét dạ dày tá tràng',
      operationType: 'Phẫu thuật dạ dày',
      method: 'Nội soi',
      surgeryDate: '2026-07-12',
      roomBed: 'P506-B1',
      currentPod: 0,
    },
    {
      caseId: 'CASE-009',
      nameInitials: 'B.V.I',
      age: 54,
      gender: 'Nam',
      diagnosis: 'Polyp đại tràng đa ổ',
      operationType: 'Phẫu thuật đại trực tràng',
      method: 'Nội soi',
      surgeryDate: '2026-07-06',
      roomBed: 'P506-B2',
      currentPod: 3,
    },
    {
      caseId: 'CASE-010',
      nameInitials: 'T.M.K',
      age: 60,
      gender: 'Nữ',
      diagnosis: 'Ung thư dạ dày giai đoạn II',
      operationType: 'Phẫu thuật dạ dày',
      method: 'Mở',
      surgeryDate: '2026-07-03',
      roomBed: 'P506-B3',
      currentPod: 4,
    },
  ];

  for (const patient of patientCases) {
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
        patient.caseId,
        patient.nameInitials,
        patient.age,
        patient.gender,
        patient.diagnosis,
        operationTypeByName[patient.operationType],
        patient.method,
        patient.surgeryDate,
        patient.roomBed,
        patient.currentPod,
        nurseId,
      ],
    );
  }
  console.log('✅ 10 patient cases seeded (P101: 1, P503: 2, P504: 4, P506: 3)');

  await queryRunner.release();
  await AppDataSource.destroy();
  console.log('🎉 Seed completed!');
}

seed().catch((err) => {
  console.error('❌ Seed failed:', err);
  process.exit(1);
});
