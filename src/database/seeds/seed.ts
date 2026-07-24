import * as bcrypt from 'bcrypt';
import { formatISO, subDays, subMinutes } from 'date-fns';
import 'dotenv/config';
import AppDataSource from '../../data-source';
import { Role } from 'src/modules/user/entities/role.entity';
import { User } from 'src/modules/user/entities/user.entity';
import { UserRole } from 'src/modules/user/enums/user-role.enum';
import { DeepPartial } from 'typeorm';
import { OperationType } from 'src/modules/patient/entities/operation-type.entity';
import { Patient } from 'src/modules/patient/entities/patient.entity';
import { SymptomSurvey } from 'src/modules/symptom-survey/entities/symptom-survey.entity';
import { PodProtocol } from 'src/modules/diet-guidance/entities/pod-protocol.entity';
import { Level } from 'src/modules/patient/entities/level.entity';
import { Levels } from 'src/modules/patient/constants/levels.constant';
import { SurveyQuestion } from 'src/modules/symptom-survey/entities/survey-question.entity';
import { QuestionOption } from 'src/modules/symptom-survey/entities/question-option.entity';

const SALT_ROUNDS = 10;

async function seed() {
  console.log('🌱 [Seed] Initializing TypeORM DataSource...');

  await AppDataSource.initialize();

  const queryRunner = AppDataSource.createQueryRunner();
  await queryRunner.connect();

  console.log('🧹 [Seed] Wiping old data...');

  const entities = AppDataSource.entityMetadatas;
  const PROTECTED_TABLES = [
    AppDataSource.getMetadata(SurveyQuestion).tableName,
    AppDataSource.getMetadata(QuestionOption).tableName,
    AppDataSource.getMetadata(Level).tableName,
  ];

  const rolesRepository = AppDataSource.getRepository(Role);
  const usersRepository = AppDataSource.getRepository(User);
  const operationTypesRepository = AppDataSource.getRepository(OperationType);
  const patientsRepository = AppDataSource.getRepository(Patient);
  const symptomSurveysRepository = AppDataSource.getRepository(SymptomSurvey);
  const podProtocolsRepository = AppDataSource.getRepository(PodProtocol);

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

  const podProtocols: DeepPartial<PodProtocol>[] = [
    ...Array.from({ length: 6 }).map((_, pod) => ({
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
    })),
    ...Array.from({ length: 6 }).map((_, pod) => ({
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
    })),
  ];

  await podProtocolsRepository.save(podProtocols);
  console.log('✅ POD protocols seeded (POD 0-5 for both operation types)');

  const now = new Date();
  const levelToScore = {
    RED: 5,
    YELLOW: 3,
    GREEN: 1,
  } satisfies Record<string, number>;

  const patientCases: (DeepPartial<Patient> & { assessmentTimeAgo: number })[] = [
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
      surgeryDate: formatISO(subDays(now, 7), { representation: 'date' }),
      roomBed: 'P502',
      currentPod: 2,
      podStartDate: formatISO(subDays(now, 5), { representation: 'date' }),
      assessmentTimeAgo: 15,
      assignedNurse: savedUsers[2],
      level: Levels.YELLOW,
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
      surgeryDate: formatISO(subDays(now, 10), { representation: 'date' }),
      roomBed: 'P502',
      currentPod: 1,
      podStartDate: formatISO(subDays(now, 3), { representation: 'date' }),
      assessmentTimeAgo: 8,
      assignedNurse: savedUsers[2],
      level: Levels.GREEN,
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
      surgeryDate: formatISO(subDays(now, 5), { representation: 'date' }),
      roomBed: 'P502',
      currentPod: 3,
      podStartDate: formatISO(subDays(now, 4), { representation: 'date' }),
      assessmentTimeAgo: 8,
      assignedNurse: savedUsers[2],
      level: Levels.RED,
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
      surgeryDate: formatISO(subDays(now, 6), { representation: 'date' }),
      roomBed: 'P502',
      currentPod: 2,
      podStartDate: formatISO(subDays(now, 2), { representation: 'date' }),
      assessmentTimeAgo: 12,
      assignedNurse: savedUsers[2],
      level: Levels.GREEN,
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
      surgeryDate: formatISO(subDays(now, 8), { representation: 'date' }),
      roomBed: 'P504-B2',
      currentPod: 4,
      podStartDate: formatISO(subDays(now, 6), { representation: 'date' }),
      assessmentTimeAgo: 5,
      assignedNurse: savedUsers[2],
      level: Levels.YELLOW,
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
      surgeryDate: formatISO(subDays(now, 4), { representation: 'date' }),
      roomBed: 'P504-B3',
      currentPod: 1,
      podStartDate: formatISO(subDays(now, 24), { representation: 'date' }),
      assessmentTimeAgo: 18,
      assignedNurse: savedUsers[2],
      level: Levels.RED,
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
      surgeryDate: formatISO(subDays(now, 12), { representation: 'date' }),
      roomBed: 'P504-B4',
      currentPod: 5,
      podStartDate: formatISO(subDays(now, 10), { representation: 'date' }),
      assessmentTimeAgo: 22,
      assignedNurse: savedUsers[2],
      level: Levels.GREEN,
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
      surgeryDate: formatISO(subDays(now, 2), { representation: 'date' }),
      roomBed: 'P506-B1',
      currentPod: 0,
      podStartDate: formatISO(subDays(now, 12), { representation: 'date' }),
      assessmentTimeAgo: 10,
      assignedNurse: savedUsers[2],
      level: Levels.YELLOW,
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
      surgeryDate: formatISO(subDays(now, 9), { representation: 'date' }),
      roomBed: 'P506-B2',
      currentPod: 3,
      podStartDate: formatISO(subDays(now, 7), { representation: 'date' }),
      assessmentTimeAgo: 20,
      assignedNurse: savedUsers[2],
      level: Levels.RED,
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
      surgeryDate: formatISO(subDays(now, 11), { representation: 'date' }),
      roomBed: 'P506-B3',
      currentPod: 4,
      podStartDate: formatISO(subDays(now, 8), { representation: 'date' }),
      assignedNurse: savedUsers[2],
      assessmentTimeAgo: 28,
      level: Levels.GREEN,
    },
  ];

  const savedPatientCases = await patientsRepository.save(patientCases);
  console.log('✅ 10 patient cases seeded with ERAS started + assessment completed');
  console.log('   - Room distribution: P502(3), P504(3), P506(4)');
  console.log('   - Level distribution: Red(3), Yellow(3), Green(4)');

  const symptomSurveys: DeepPartial<SymptomSurvey>[] = savedPatientCases.map((patient) => {
    const levelName = patient.level!.levelName;

    const survey = {
      caseId: patient.caseId,
      evaluationDatetime: subMinutes(now, patient.assessmentTimeAgo),
      podContext: patient.currentPod,
      totalScore: levelToScore[levelName.toUpperCase() as keyof typeof levelToScore],
      triageColor: levelName,
    };

    console.log(
      `   ✅ Assessment for ${survey.caseId}: ${survey.triageColor} (score: ${survey.totalScore}) - ${patient.assessmentTimeAgo} minute(s) ago`,
    );

    return survey;
  });

  await symptomSurveysRepository.save(symptomSurveys);
  console.log('✅ 10 patient assessments seeded');

  await queryRunner.release();
  await AppDataSource.destroy();
  console.log('🎉 Seed completed!');
}

seed().catch((err) => {
  console.error('❌ Seed failed:', err);
  process.exit(1);
});
