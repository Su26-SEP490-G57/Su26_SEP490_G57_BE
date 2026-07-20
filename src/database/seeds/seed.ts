/* eslint-disable @typescript-eslint/no-unsafe-argument */
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

  // eslint-disable-next-line prettier/prettier
  const PROTECTED_TABLES = ['survey_questions', 'question_options', 'levels'];

  const entities = AppDataSource.entityMetadatas;
  await queryRunner.query('SET CONSTRAINTS ALL DEFERRED;');

  for (const entity of entities) {
    const tableName = entity.tableName;

    if (PROTECTED_TABLES.includes(tableName)) {
      console.log(`   - Skipping protected table: ${tableName}`);
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
      fullName: 'Nguyễn Văn An',
      role: 'Patient',
      caseId: 'CASE-001',
    },
    {
      username: 'patient02',
      password: 'Patient@123',
      fullName: 'Trần Thị Bình',
      role: 'Patient',
      caseId: 'CASE-002',
    },
    {
      username: 'patient03',
      password: 'Patient@123',
      fullName: 'Lê Văn Cường',
      role: 'Patient',
      caseId: 'CASE-003',
    },
    {
      username: 'patient04',
      password: 'Patient@123',
      fullName: 'Phạm Thị Dung',
      role: 'Patient',
      caseId: 'CASE-004',
    },
    {
      username: 'patient05',
      password: 'Patient@123',
      fullName: 'Hoàng Minh Đức',
      role: 'Patient',
      caseId: 'CASE-005',
    },
    {
      username: 'patient06',
      password: 'Patient@123',
      fullName: 'Đặng Thị Hoa',
      role: 'Patient',
      caseId: 'CASE-006',
    },
    {
      username: 'patient07',
      password: 'Patient@123',
      fullName: 'Vũ Văn Hùng',
      role: 'Patient',
      caseId: 'CASE-007',
    },
    {
      username: 'patient08',
      password: 'Patient@123',
      fullName: 'Ngô Thị Lan',
      role: 'Patient',
      caseId: 'CASE-008',
    },
    {
      username: 'patient09',
      password: 'Patient@123',
      fullName: 'Bùi Văn Minh',
      role: 'Patient',
      caseId: 'CASE-009',
    },
    {
      username: 'patient10',
      password: 'Patient@123',
      fullName: 'Trương Mai Phương',
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

  // Current time for realistic seed data
  const now = new Date();

  const patientCases = [
    {
      caseId: 'CASE-001',
      age: 55,
      gender: 'Nam',
      height: 168,
      weight: 62,
      bmi: 22.0,
      diagnosis: 'Ung thư đại tràng giai đoạn II',
      operationType: 'Phẫu thuật đại trực tràng',
      method: 'Nội soi',
      surgeryDate: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 7 days ago
      roomBed: 'P101-B1',
      currentPod: 2,
      podStartDate: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000), // 5 days ago
      assessmentTimeAgo: 45, // 45 minutes ago
      levelId: 3, // Green - stable
    },
    {
      caseId: 'CASE-002',
      age: 48,
      gender: 'Nữ',
      height: 156,
      weight: 52,
      bmi: 21.4,
      diagnosis: 'Loét dạ dày chảy máu',
      operationType: 'Phẫu thuật dạ dày',
      method: 'Mở',
      surgeryDate: new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 10 days ago
      roomBed: 'P503-B1',
      currentPod: 1,
      podStartDate: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000), // 3 days ago
      assessmentTimeAgo: 120, // 2 hours ago
      levelId: 2, // Yellow - moderate
    },
    {
      caseId: 'CASE-003',
      age: 62,
      gender: 'Nam',
      height: 172,
      weight: 75,
      bmi: 25.4,
      diagnosis: 'Polyp đại tràng có nguy cơ ác tính',
      operationType: 'Phẫu thuật đại trực tràng',
      method: 'Nội soi',
      surgeryDate: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 5 days ago
      roomBed: 'P503-B2',
      currentPod: 3,
      podStartDate: new Date(now.getTime() - 4 * 24 * 60 * 60 * 1000), // 4 days ago
      assessmentTimeAgo: 30, // 30 minutes ago
      levelId: 3, // Green - stable
    },
    {
      caseId: 'CASE-004',
      age: 51,
      gender: 'Nữ',
      height: 160,
      weight: 58,
      bmi: 22.7,
      diagnosis: 'U dạ dày lành tính kích thước lớn',
      operationType: 'Phẫu thuật dạ dày',
      method: 'Nội soi',
      surgeryDate: new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 6 days ago
      roomBed: 'P504-B1',
      currentPod: 2,
      podStartDate: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
      assessmentTimeAgo: 180, // 3 hours ago
      levelId: 2, // Yellow - moderate
    },
    {
      caseId: 'CASE-005',
      age: 45,
      gender: 'Nam',
      height: 175,
      weight: 82,
      bmi: 26.8,
      diagnosis: 'Viêm túi thừa đại tràng biến chứng',
      operationType: 'Phẫu thuật đại trực tràng',
      method: 'Mở',
      surgeryDate: new Date(now.getTime() - 8 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 8 days ago
      roomBed: 'P504-B2',
      currentPod: 4,
      podStartDate: new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000), // 6 days ago
      assessmentTimeAgo: 15, // 15 minutes ago
      levelId: 1, // Red - high risk
    },
    {
      caseId: 'CASE-006',
      age: 58,
      gender: 'Nữ',
      height: 158,
      weight: 49,
      bmi: 19.6,
      diagnosis: 'Viêm loét dạ dày mạn tính không đáp ứng điều trị nội khoa',
      operationType: 'Phẫu thuật dạ dày',
      method: 'Nội soi',
      surgeryDate: new Date(now.getTime() - 4 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 4 days ago
      roomBed: 'P504-B3',
      currentPod: 1,
      podStartDate: new Date(now.getTime() - 24 * 60 * 60 * 1000), // 1 day ago
      assessmentTimeAgo: 60, // 1 hour ago
      levelId: 3, // Green - stable
    },
    {
      caseId: 'CASE-007',
      age: 67,
      gender: 'Nam',
      height: 165,
      weight: 58,
      bmi: 21.3,
      diagnosis: 'Ung thư trực tràng giai đoạn III',
      operationType: 'Phẫu thuật đại trực tràng',
      method: 'Mở',
      surgeryDate: new Date(now.getTime() - 12 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 12 days ago
      roomBed: 'P504-B4',
      currentPod: 5,
      podStartDate: new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000), // 10 days ago
      assessmentTimeAgo: 90, // 1.5 hours ago
      levelId: 2, // Yellow - moderate
    },
    {
      caseId: 'CASE-008',
      age: 43,
      gender: 'Nữ',
      height: 162,
      weight: 55,
      bmi: 21.0,
      diagnosis: 'Chít hẹp môn vị do loét',
      operationType: 'Phẫu thuật dạ dày',
      method: 'Nội soi',
      surgeryDate: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 2 days ago
      roomBed: 'P506-B1',
      currentPod: 0,
      podStartDate: new Date(now.getTime() - 12 * 60 * 60 * 1000), // 12 hours ago
      assessmentTimeAgo: 10, // 10 minutes ago
      levelId: 3, // Green - stable
    },
    {
      caseId: 'CASE-009',
      age: 54,
      gender: 'Nam',
      height: 170,
      weight: 68,
      bmi: 23.5,
      diagnosis: 'Bệnh Crohn đại tràng không đáp ứng điều trị',
      operationType: 'Phẫu thuật đại trực tràng',
      method: 'Nội soi',
      surgeryDate: new Date(now.getTime() - 9 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 9 days ago
      roomBed: 'P506-B2',
      currentPod: 3,
      podStartDate: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000), // 7 days ago
      assessmentTimeAgo: 20, // 20 minutes ago
      levelId: 1, // Red - high risk
    },
    {
      caseId: 'CASE-010',
      age: 60,
      gender: 'Nữ',
      height: 155,
      weight: 60,
      bmi: 25.0,
      diagnosis: 'Ung thư dạ dày giai đoạn IB',
      operationType: 'Phẫu thuật dạ dày',
      method: 'Mở',
      surgeryDate: new Date(now.getTime() - 11 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 11 days ago
      roomBed: 'P506-B3',
      currentPod: 4,
      podStartDate: new Date(now.getTime() - 8 * 24 * 60 * 60 * 1000), // 8 days ago
      assessmentTimeAgo: 150, // 2.5 hours ago
      levelId: 2, // Yellow - moderate
    },
  ];

  for (const patient of patientCases) {
    await AppDataSource.query(
      `
      INSERT INTO ${schema}."patient_cases" (
        "case_id", "age", "gender", "height", "weight", "bmi",
        "diagnosis", "operation_type_id", "method",
        "surgery_date", "room_bed", "current_pod",
        "assigned_nurse_id", "pod_start_date", "level_id"
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      ON CONFLICT ("case_id") DO NOTHING
    `,
      [
        patient.caseId,
        patient.age,
        patient.gender,
        patient.height,
        patient.weight,
        patient.bmi,
        patient.diagnosis,
        operationTypeByName[patient.operationType],
        patient.method,
        patient.surgeryDate,
        patient.roomBed,
        patient.currentPod,
        nurseId,
        patient.podStartDate,
        patient.levelId,
      ],
    );
  }
  console.log('✅ 10 patient cases seeded with ERAS started + assessment completed');
  console.log('   - Room distribution: P101(1), P503(2), P504(4), P506(3)');
  console.log('   - Level distribution: Red(2), Yellow(4), Green(4)');

  // Seed patient assessments (1 per patient)
  console.log('🔬 Seeding patient assessments...');
  const levelToTriageColor: Record<number, string> = {
    1: 'RED',
    2: 'YELLOW',
    3: 'GREEN',
  };

  const levelToScore: Record<number, number> = {
    1: 5, // RED: score > 3
    2: 3, // YELLOW: score 2-3
    3: 1, // GREEN: score 0-1
  };

  for (const patient of patientCases) {
    const triageColor = levelToTriageColor[patient.levelId];
    const totalScore = levelToScore[patient.levelId];

    // Calculate assessment time based on assessmentTimeAgo (minutes ago from now)
    const assessmentTime = new Date(now.getTime() - patient.assessmentTimeAgo * 60 * 1000);

    // Insert assessment
    await AppDataSource.query(
      `
      INSERT INTO ${schema}."patient_assessments" (
        "case_id", "evaluation_datetime", "pod_context",
        "total_score", "triage_color"
      )
      VALUES ($1, $2, $3, $4, $5)
      RETURNING "assessment_id"
    `,
      [patient.caseId, assessmentTime, patient.currentPod, totalScore, triageColor],
    );

    console.log(
      `   ✓ Assessment for ${patient.caseId}: ${triageColor} (score: ${totalScore}) - ${patient.assessmentTimeAgo}min ago`,
    );
  }

  console.log('✅ 10 patient assessments seeded');

  await queryRunner.release();
  await AppDataSource.destroy();
  console.log('🎉 Seed completed!');
}

seed().catch((err) => {
  console.error('❌ Seed failed:', err);
  process.exit(1);
});
