/* eslint-disable @typescript-eslint/no-unused-vars */

import * as bcrypt from 'bcrypt';
import 'dotenv/config';
import { OperationType } from 'src/modules/patient/entities/operation-type.entity';
import { Patient } from 'src/modules/patient/entities/patient.entity';
import { Role } from 'src/modules/user/entities/role.entity';
import { User } from 'src/modules/user/entities/user.entity';
import { UserRole } from 'src/modules/user/enums/user-role.enum';
import { DeepPartial } from 'typeorm';
import AppDataSource from '../../data-source';

const SALT_ROUNDS = 10;

async function seed() {
  console.log('🌱 [Seed] Initializing TypeORM DataSource...');

  await AppDataSource.initialize();

  const queryRunner = AppDataSource.createQueryRunner();
  await queryRunner.connect();

  console.log('🧹 [Seed] Wiping old data...');

  const PROTECTED_TABLES = ['survey_questions', 'question_options', 'levels'];

  const entities = AppDataSource.entityMetadatas;
  const rolesRepository = AppDataSource.getRepository(Role);
  const usersRepository = AppDataSource.getRepository(User);
  const operationTypesRepository = AppDataSource.getRepository(OperationType);
  const patientsRepository = AppDataSource.getRepository(Patient);

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

  const roles: DeepPartial<Role>[] = [
    {
      id: 1,
      ...UserRole.ADMIN,
    },
    {
      id: 2,
      ...UserRole.HEAD_NURSE,
    },
    {
      id: 3,
      ...UserRole.NURSE,
    },
    {
      id: 4,
      ...UserRole.PATIENT,
    },
  ];

  const savedRoles = await rolesRepository.save(roles);
  console.log('✅ Roles seeded');

  const ADMIN_HASH = await bcrypt.hash('Admin@123', SALT_ROUNDS);
  const NURSE_HASH = await bcrypt.hash('Nurse@123', SALT_ROUNDS);
  const PATIENT_HASH = await bcrypt.hash('Patient@123', SALT_ROUNDS);

  const users: DeepPartial<User>[] = [
    {
      id: 1,
      username: 'admin',
      passwordHash: ADMIN_HASH,
      fullName: 'Quản trị viên',
      roles: [savedRoles[0]],
      caseId: null,
      isActive: true,
    },
    {
      id: 2,
      username: 'head_nurse',
      passwordHash: NURSE_HASH,
      fullName: 'Điều dưỡng trưởng',
      roles: [savedRoles[1]],
      caseId: null,
      isActive: true,
    },
    {
      id: 3,
      username: 'nurse01',
      passwordHash: NURSE_HASH,
      fullName: 'Điều dưỡng 01',
      roles: [savedRoles[2]],
      caseId: null,
      isActive: true,
    },
    {
      id: 4,
      username: 'patient01',
      passwordHash: PATIENT_HASH,
      fullName: 'Nguyễn Văn An',
      roles: [savedRoles[3]],
      caseId: 'CASE-001',
      isActive: true,
    },
    {
      id: 5,
      username: 'patient02',
      passwordHash: PATIENT_HASH,
      fullName: 'Trần Thị Bình',
      roles: [savedRoles[3]],
      caseId: 'CASE-002',
      isActive: true,
    },
    {
      id: 6,
      username: 'patient03',
      passwordHash: PATIENT_HASH,
      fullName: 'Lê Văn Cường',
      roles: [savedRoles[3]],
      caseId: 'CASE-003',
      isActive: true,
    },
    {
      id: 7,
      username: 'patient04',
      passwordHash: PATIENT_HASH,
      fullName: 'Phạm Thị Dung',
      roles: [savedRoles[3]],
      caseId: 'CASE-004',
      isActive: true,
    },
    {
      id: 8,
      username: 'patient05',
      passwordHash: PATIENT_HASH,
      fullName: 'Hoàng Minh Đức',
      roles: [savedRoles[3]],
      caseId: 'CASE-005',
      isActive: true,
    },
    {
      id: 9,
      username: 'patient06',
      passwordHash: PATIENT_HASH,
      fullName: 'Đặng Thị Hoa',
      roles: [savedRoles[3]],
      caseId: 'CASE-006',
      isActive: true,
    },
    {
      id: 10,
      username: 'patient07',
      passwordHash: PATIENT_HASH,
      fullName: 'Vũ Văn Hùng',
      roles: [savedRoles[3]],
      caseId: 'CASE-007',
      isActive: true,
    },
    {
      id: 11,
      username: 'patient08',
      passwordHash: PATIENT_HASH,
      fullName: 'Ngô Thị Lan',
      roles: [savedRoles[3]],
      caseId: 'CASE-008',
      isActive: true,
    },
    {
      id: 12,
      username: 'patient09',
      passwordHash: PATIENT_HASH,
      fullName: 'Bùi Văn Minh',
      roles: [savedRoles[3]],
      caseId: 'CASE-009',
      isActive: true,
    },
    {
      id: 13,
      username: 'patient10',
      passwordHash: PATIENT_HASH,
      fullName: 'Trương Mai Phương',
      roles: [savedRoles[3]],
      caseId: 'CASE-010',
      isActive: true,
    },
  ];

  const savedUsers = await usersRepository.save(users);
  savedUsers.forEach((user) =>
    console.log(
      `✅ User "${user.username}" of roles [${user.roles?.map((role) => role.roleName).join(', ')}] seeded`,
    ),
  );

  const operationTypes: DeepPartial<OperationType>[] = [
    { operationTypeId: 1, operationName: 'Phẫu thuật dạ dày' },
    { operationTypeId: 2, operationName: 'Phẫu thuật đại trực tràng' },
  ];

  const savedOperationTypes = await operationTypesRepository.save(operationTypes);

  console.log(
    `✅ Operation types seeded: [${operationTypes.map((operationType) => operationType.operationName).join(', ')}]`,
  );

  // Get nurse01 user ID for assigned_nurse_id
  const nurse01 = savedUsers.find((u) => u.username === 'nurse01');
  const nurseId = nurse01?.id ?? null;

  // Map operation type names to IDs
  const operationTypeByName: Record<string, number> = {};
  savedOperationTypes.forEach((op) => {
    if (op.operationName) {
      operationTypeByName[op.operationName] = op.operationTypeId!;
    }
  });

  // Schema for raw SQL queries
  const schema = `"${process.env.DB_SCHEMA || 'public'}"`;

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
      operationType: savedOperationTypes[1],
      method: 'Nội soi',
      surgeryDate: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 7 days ago
      roomBed: 'P502',
      currentPod: 2,
      podStartDate: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000), // 5 days ago
      assessmentTimeAgo: 15,
      levelId: 2, // Yellow
    },
    {
      caseId: 'CASE-002',
      age: 48,
      gender: 'Nữ',
      height: 156,
      weight: 52,
      bmi: 21.4,
      diagnosis: 'Loét dạ dày chảy máu',
      operationType: savedOperationTypes[0],
      method: 'Mở',
      surgeryDate: new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 10 days ago
      roomBed: 'P502',
      currentPod: 1,
      podStartDate: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000), // 3 days ago
      assessmentTimeAgo: 25,
      levelId: 3, // Green
    },
    {
      caseId: 'CASE-003',
      age: 62,
      gender: 'Nam',
      height: 172,
      weight: 75,
      bmi: 25.4,
      diagnosis: 'Polyp đại tràng có nguy cơ ác tính',
      operationType: savedOperationTypes[1],
      method: 'Nội soi',
      surgeryDate: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 5 days ago
      roomBed: 'P502',
      currentPod: 3,
      podStartDate: new Date(now.getTime() - 4 * 24 * 60 * 60 * 1000), // 4 days ago
      assessmentTimeAgo: 8,
      levelId: 1, // Red
    },
    {
      caseId: 'CASE-004',
      age: 51,
      gender: 'Nữ',
      height: 160,
      weight: 58,
      bmi: 22.7,
      diagnosis: 'U dạ dày lành tính kích thước lớn',
      operationType: savedOperationTypes[0],
      method: 'Nội soi',
      surgeryDate: new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 6 days ago
      roomBed: 'P504',
      currentPod: 2,
      podStartDate: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
      assessmentTimeAgo: 12,
      levelId: 3, // Green
    },
    {
      caseId: 'CASE-005',
      age: 45,
      gender: 'Nam',
      height: 175,
      weight: 82,
      bmi: 26.8,
      diagnosis: 'Viêm túi thừa đại tràng biến chứng',
      operationType: savedOperationTypes[1],
      method: 'Mở',
      surgeryDate: new Date(now.getTime() - 8 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 8 days ago
      roomBed: 'P504',
      currentPod: 4,
      podStartDate: new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000), // 6 days ago
      assessmentTimeAgo: 5,
      levelId: 2, // Yellow
    },
    {
      caseId: 'CASE-006',
      age: 58,
      gender: 'Nữ',
      height: 158,
      weight: 49,
      bmi: 19.6,
      diagnosis: 'Viêm loét dạ dày mạn tính không đáp ứng điều trị nội khoa',
      operationType: savedOperationTypes[0],
      method: 'Nội soi',
      surgeryDate: new Date(now.getTime() - 4 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 4 days ago
      roomBed: 'P504',
      currentPod: 1,
      podStartDate: new Date(now.getTime() - 24 * 60 * 60 * 1000), // 1 day ago
      assessmentTimeAgo: 18,
      levelId: 1, // Red
    },
    {
      caseId: 'CASE-007',
      age: 67,
      gender: 'Nam',
      height: 165,
      weight: 58,
      bmi: 21.3,
      diagnosis: 'Ung thư trực tràng giai đoạn III',
      operationType: savedOperationTypes[1],
      method: 'Mở',
      surgeryDate: new Date(now.getTime() - 12 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 12 days ago
      roomBed: 'P502',
      currentPod: 5,
      podStartDate: new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000), // 10 days ago
      assessmentTimeAgo: 22,
      levelId: 3, // Green
    },
    {
      caseId: 'CASE-008',
      age: 43,
      gender: 'Nữ',
      height: 162,
      weight: 55,
      bmi: 21.0,
      diagnosis: 'Chít hẹp môn vị do loét',
      operationType: savedOperationTypes[0],
      method: 'Nội soi',
      surgeryDate: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 2 days ago
      roomBed: 'P506',
      currentPod: 0,
      podStartDate: new Date(now.getTime() - 12 * 60 * 60 * 1000), // 12 hours ago
      assessmentTimeAgo: 10,
      levelId: 2, // Yellow
    },
    {
      caseId: 'CASE-009',
      age: 54,
      gender: 'Nam',
      height: 170,
      weight: 68,
      bmi: 23.5,
      diagnosis: 'Bệnh Crohn đại tràng không đáp ứng điều trị',
      operationType: savedOperationTypes[1],
      method: 'Nội soi',
      surgeryDate: new Date(now.getTime() - 9 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 9 days ago
      roomBed: 'P506',
      currentPod: 3,
      podStartDate: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000), // 7 days ago
      assessmentTimeAgo: 20,
      levelId: 1, // Red
    },
    {
      caseId: 'CASE-010',
      age: 60,
      gender: 'Nữ',
      height: 155,
      weight: 60,
      bmi: 25.0,
      diagnosis: 'Ung thư dạ dày giai đoạn IB',
      operationType: savedOperationTypes[0],
      method: 'Mở',
      surgeryDate: new Date(now.getTime() - 11 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 11 days ago
      roomBed: 'P506',
      currentPod: 4,
      podStartDate: new Date(now.getTime() - 8 * 24 * 60 * 60 * 1000), // 8 days ago
      assessmentTimeAgo: 28,
      levelId: 3, // Green
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
        patient.operationType.operationTypeId,
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
  console.log('   - Room distribution: P502(3), P504(3), P506(4)');
  console.log('   - Level distribution: Red(3), Yellow(3), Green(4)');

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

  // Seed POD protocols (POD 0-5 for both operation types)
  console.log('🔬 Seeding POD protocols...');

  const podProtocols: Array<{
    operationTypeId: number;
    label: string;
    mealsPerDayMin: number;
    mealsPerDayMax: number;
    mealInstruction: string;
    volumePerMealMin: number;
    volumePerMealMax: number;
    volumeInstruction: string;
    recommendedFoods: string[];
    recommendedDrinks: string[];
  }> = [];

  // POD 0-5 for "Phẫu thuật dạ dày" (operation_type_id = 1)
  for (let pod = 0; pod <= 5; pod++) {
    podProtocols.push({
      operationTypeId: 1,
      label: `POD ${pod}`,
      mealsPerDayMin: pod === 0 ? 0 : 3 + pod,
      mealsPerDayMax: pod === 0 ? 0 : 6 + pod,
      mealInstruction: `Hướng dẫn ăn uống cho POD ${pod} - Phẫu thuật dạ dày`,
      volumePerMealMin: pod === 0 ? 0 : 50 + pod * 50,
      volumePerMealMax: pod === 0 ? 0 : 100 + pod * 50,
      volumeInstruction: `Khối lượng thức ăn khuyến nghị cho POD ${pod}`,
      recommendedFoods: pod === 0 ? [] : ['Cháo loãng', 'Súp', 'Nước trái cây'],
      recommendedDrinks: pod === 0 ? [] : ['Nước lọc', 'Nước chanh', 'Trà loãng'],
    });
  }

  // POD 0-5 for "Phẫu thuật đại trực tràng" (operation_type_id = 2)
  for (let pod = 0; pod <= 5; pod++) {
    podProtocols.push({
      operationTypeId: 2,
      label: `POD ${pod}`,
      mealsPerDayMin: pod === 0 ? 0 : 3 + pod,
      mealsPerDayMax: pod === 0 ? 0 : 6 + pod,
      mealInstruction: `Hướng dẫn ăn uống cho POD ${pod} - Phẫu thuật đại trực tràng`,
      volumePerMealMin: pod === 0 ? 0 : 50 + pod * 50,
      volumePerMealMax: pod === 0 ? 0 : 100 + pod * 50,
      volumeInstruction: `Khối lượng thức ăn khuyến nghị cho POD ${pod}`,
      recommendedFoods: pod === 0 ? [] : ['Cháo loãng', 'Súp', 'Nước trái cây'],
      recommendedDrinks: pod === 0 ? [] : ['Nước lọc', 'Nước chanh', 'Trà loãng'],
    });
  }

  for (const protocol of podProtocols) {
    await AppDataSource.query(
      `
      INSERT INTO ${schema}."pod_protocols" (
        "operation_type_id", "label",
        "meals_per_day_min", "meals_per_day_max", "meal_instruction",
        "volume_per_meal_min", "volume_per_meal_max", "volume_instruction",
        "recommended_foods", "recommended_drinks"
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      ON CONFLICT DO NOTHING
    `,
      [
        protocol.operationTypeId,
        protocol.label,
        protocol.mealsPerDayMin,
        protocol.mealsPerDayMax,
        protocol.mealInstruction,
        protocol.volumePerMealMin,
        protocol.volumePerMealMax,
        protocol.volumeInstruction,
        protocol.recommendedFoods,
        protocol.recommendedDrinks,
      ],
    );
  }

  console.log('✅ POD protocols seeded (POD 0-5 for both operation types)');

  await queryRunner.release();
  await AppDataSource.destroy();
  console.log('🎉 Seed completed!');
}

seed().catch((err) => {
  console.error('❌ Seed failed:', err);
  process.exit(1);
});
