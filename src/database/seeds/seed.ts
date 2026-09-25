import * as bcrypt from 'bcrypt';
import { formatISO, subDays, subMinutes } from 'date-fns';
import 'dotenv/config';
import { PodProtocol } from 'src/modules/diet-guidance/entities/pod-protocol.entity';
import { Levels } from 'src/modules/patient/constants/levels.constant';
import { Level } from 'src/modules/patient/entities/level.entity';
import { OperationType } from 'src/modules/patient/entities/operation-type.entity';
import { Patient } from 'src/modules/patient/entities/patient.entity';
import { DEFAULT_QUESTIONNAIRE_VERSION_ID } from 'src/modules/symptom-survey/constants/questionnaire-version.constant';
import { AssessmentDetail } from 'src/modules/symptom-survey/entities/assessment-detail.entity';
import { QuestionOption } from 'src/modules/symptom-survey/entities/question-option.entity';
import { SurveyQuestion } from 'src/modules/symptom-survey/entities/survey-question.entity';
import { SymptomSurvey } from 'src/modules/symptom-survey/entities/symptom-survey.entity';
import { Role } from 'src/modules/user/entities/role.entity';
import { User } from 'src/modules/user/entities/user.entity';
import { UserRole } from 'src/modules/user/enums/user-role.enum';
import { DataSource, DeepPartial } from 'typeorm';
import AppDataSource from '../../data-source';
import { CareObservationSheetTemplate } from 'src/modules/care-observation/entities/care-observation-sheet-template.entity';
import { Disease } from 'src/modules/disease/entities/disease.entity';

const SALT_ROUNDS = 10;

export async function seed(
  dataSource: DataSource = AppDataSource,
  { closeConnection = true, verbose = true }: { closeConnection?: boolean; verbose?: boolean } = {},
) {
  const log = verbose ? console.log : () => {};

  log('🌱 [Seed] Initializing TypeORM DataSource...');

  if (!dataSource.isInitialized) {
    await dataSource.initialize();
  }

  const queryRunner = dataSource.createQueryRunner();
  await queryRunner.connect();

  log('🧹 [Seed] Wiping old data...');

  const entities = dataSource.entityMetadatas;
  const PROTECTED_TABLES = [
    dataSource.getMetadata(SurveyQuestion).tableName,
    dataSource.getMetadata(QuestionOption).tableName,
    dataSource.getMetadata(Level).tableName,
    dataSource.getMetadata(CareObservationSheetTemplate).tableName,
    // ICD-10 catalogue — reference data seeded by migration CreateDiseasesTable.
    dataSource.getMetadata(Disease).tableName,
  ];

  const rolesRepository = dataSource.getRepository(Role);
  const usersRepository = dataSource.getRepository(User);
  const operationTypesRepository = dataSource.getRepository(OperationType);
  const patientsRepository = dataSource.getRepository(Patient);
  const symptomSurveysRepository = dataSource.getRepository(SymptomSurvey);
  const podProtocolsRepository = dataSource.getRepository(PodProtocol);

  await queryRunner.query(
    "INSERT INTO \"care_observation_sheet_templates\" (\"code\", \"name\", \"checklist_items\") VALUES ('LEVEL_1_SHEET', 'Phiếu theo dõi chăm sóc cấp 1', '[]'::jsonb), ('LEVEL_2_3_SHEET', 'Phiếu theo dõi chăm sóc cấp 2-3', '[]'::jsonb) ON CONFLICT (\"code\") DO NOTHING;",
  );
  log('✅ Care observation sheet templates ensured');
  await queryRunner.query('SET CONSTRAINTS ALL DEFERRED;');

  for (const entity of entities) {
    const tableName = entity.tableName;

    if (PROTECTED_TABLES.includes(tableName)) {
      log(`   - Skipping protected table: ${tableName}`);
      continue;
    }

    log(`   - Truncating table: ${tableName}`);
    await queryRunner.query(`TRUNCATE TABLE "${tableName}" RESTART IDENTITY CASCADE;`);
  }

  log('📥 [Seed] Inserting fresh standard dataset...');

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
    {
      id: 5,
      ...UserRole.DOCTOR,
    },
  ];

  const savedRoles = await rolesRepository.save(roles);
  log('✅ Roles seeded');

  const ADMIN_HASH = await bcrypt.hash('Admin@123', SALT_ROUNDS);
  const NURSE_HASH = await bcrypt.hash('Nurse@123', SALT_ROUNDS);
  const DOCTOR_HASH = await bcrypt.hash('Doctor@123', SALT_ROUNDS);
  const PATIENT_HASH = await bcrypt.hash('Patient@123', SALT_ROUNDS);

  // savedRoles index: 0=Admin, 1=Head_Nurse, 2=Nurse, 3=Patient, 4=Doctor
  const doctorRole = savedRoles[4];

  const users: DeepPartial<User>[] = [
    {
      id: 1,
      username: 'admin',
      passwordHash: ADMIN_HASH,
      fullName: 'Lê Minh Quân',
      phoneNumber: '0912418263',
      dob: '1988-03-14',
      roles: [savedRoles[0]],
      caseId: null,
      isActive: true,
    },
    {
      id: 2,
      username: 'head_nurse',
      passwordHash: NURSE_HASH,
      fullName: 'Nguyễn Thị Thanh Hương',
      phoneNumber: '0983276514',
      dob: '1979-08-22',
      roles: [savedRoles[1]],
      caseId: null,
      isActive: true,
    },
    {
      id: 3,
      username: 'nurse01',
      passwordHash: NURSE_HASH,
      fullName: 'Trần Thị Thu Hà',
      phoneNumber: '0978135402',
      dob: '1994-11-05',
      roles: [savedRoles[2]],
      caseId: null,
      isActive: true,
    },
    {
      id: 4,
      username: 'patient01',
      passwordHash: PATIENT_HASH,
      fullName: 'Nguyễn Văn An',
      phoneNumber: '0913245786',
      dob: '1971-04-12',
      cityProvince: 'Thành phố Hà Nội',
      ward: 'Phường Hoàn Kiếm',
      detailedAddress: 'Số 18 ngõ 45 phố Hàng Bông',
      roles: [savedRoles[3]],
      caseId: 'CASE-001',
      isActive: true,
    },
    {
      id: 5,
      username: 'patient02',
      passwordHash: PATIENT_HASH,
      fullName: 'Trần Thị Bình',
      phoneNumber: '0986472139',
      dob: '1978-09-03',
      cityProvince: 'Tỉnh Hưng Yên',
      ward: 'Phường Phố Hiến',
      detailedAddress: 'Số 27 đường Nguyễn Văn Linh',
      roles: [savedRoles[3]],
      caseId: 'CASE-002',
      isActive: true,
    },
    {
      id: 6,
      username: 'patient03',
      passwordHash: PATIENT_HASH,
      fullName: 'Lê Văn Cường',
      phoneNumber: '0904318657',
      dob: '1964-01-25',
      cityProvince: 'Thành phố Hà Nội',
      ward: 'Phường Ba Đình',
      detailedAddress: 'Số 9 ngõ 12 phố Đội Cấn',
      roles: [savedRoles[3]],
      caseId: 'CASE-003',
      isActive: true,
    },
    {
      id: 7,
      username: 'patient04',
      passwordHash: PATIENT_HASH,
      fullName: 'Phạm Thị Dung',
      phoneNumber: '0967528341',
      dob: '1975-07-19',
      cityProvince: 'Tỉnh Ninh Bình',
      ward: 'Phường Phủ Lý',
      detailedAddress: 'Số 56 đường Lê Hoàn',
      roles: [savedRoles[3]],
      caseId: 'CASE-004',
      isActive: true,
    },
    {
      id: 8,
      username: 'patient05',
      passwordHash: PATIENT_HASH,
      fullName: 'Hoàng Minh Đức',
      phoneNumber: '0936814275',
      dob: '1980-12-08',
      cityProvince: 'Thành phố Bắc Ninh',
      ward: 'Phường Bắc Giang',
      detailedAddress: 'Số 112 đường Hùng Vương',
      roles: [savedRoles[3]],
      caseId: 'CASE-005',
      isActive: true,
    },
    {
      id: 9,
      username: 'patient06',
      passwordHash: PATIENT_HASH,
      fullName: 'Đặng Thị Hoa',
      phoneNumber: '0975603918',
      dob: '1968-05-30',
      cityProvince: 'Tỉnh Thanh Hóa',
      ward: 'Phường Hạc Thành',
      detailedAddress: 'Số 34 đường Trần Phú',
      roles: [savedRoles[3]],
      caseId: 'CASE-006',
      isActive: true,
    },
    {
      id: 10,
      username: 'patient07',
      passwordHash: PATIENT_HASH,
      fullName: 'Vũ Văn Hùng',
      phoneNumber: '0912739064',
      dob: '1959-02-14',
      cityProvince: 'Thành phố Hải Phòng',
      ward: 'Phường Hải Dương',
      detailedAddress: 'Số 7 đường Nguyễn Lương Bằng',
      roles: [savedRoles[3]],
      caseId: 'CASE-007',
      isActive: true,
    },
    {
      id: 11,
      username: 'patient08',
      passwordHash: PATIENT_HASH,
      fullName: 'Ngô Thị Lan',
      phoneNumber: '0348921576',
      dob: '1982-10-21',
      cityProvince: 'Tỉnh Phú Thọ',
      ward: 'Phường Tân Hòa',
      detailedAddress: 'Tổ 5, khu 3',
      roles: [savedRoles[3]],
      caseId: 'CASE-008',
      isActive: true,
    },
    {
      id: 12,
      username: 'patient09',
      passwordHash: PATIENT_HASH,
      fullName: 'Bùi Văn Minh',
      phoneNumber: '0389457203',
      dob: '1972-06-11',
      cityProvince: 'Tỉnh Thái Nguyên',
      ward: 'Phường Đức Xuân',
      detailedAddress: 'Số 21 đường Hoàng Văn Thụ',
      roles: [savedRoles[3]],
      caseId: 'CASE-009',
      isActive: true,
    },
    {
      id: 13,
      username: 'patient10',
      passwordHash: PATIENT_HASH,
      fullName: 'Trương Mai Phương',
      phoneNumber: '0858316942',
      dob: '1966-03-27',
      cityProvince: 'Thành phố Hà Nội',
      ward: 'Phường Giảng Võ',
      detailedAddress: 'Số 3 ngách 20/15 phố Vạn Bảo',
      roles: [savedRoles[3]],
      caseId: 'CASE-010',
      isActive: true,
    },
    // Placed last: usersRepository.save() ignores the explicit `id` on a
    // generated PK column and assigns ids sequentially by array position, so a
    // user must sit at the array index matching its intended id (14th here).
    {
      id: 14,
      username: 'doctor01',
      passwordHash: DOCTOR_HASH,
      fullName: 'Nguyễn Văn Khoa',
      phoneNumber: '0904652871',
      dob: '1981-06-17',
      roles: [doctorRole],
      caseId: null,
      isActive: true,
    },
  ];

  const savedUsers = await usersRepository.save(users);
  savedUsers.forEach((user) =>
    log(
      `✅ User "${user.username}" of roles [${user.roles?.map((role) => role.roleName).join(', ')}] seeded`,
    ),
  );

  const operationTypes: DeepPartial<OperationType>[] = [
    { operationTypeId: 1, operationName: 'Phẫu thuật dạ dày' },
    { operationTypeId: 2, operationName: 'Phẫu thuật đại trực tràng' },
  ];

  const savedOperationTypes = await operationTypesRepository.save(operationTypes);

  log(
    `✅ Operation types seeded: [${operationTypes.map((operationType) => operationType.operationName).join(', ')}]`,
  );

  const podProtocols: DeepPartial<PodProtocol>[] = [
    // Gastric Pathway (OperationType 1 - Phẫu thuật Dạ dày / Tiêu hóa trên)
    {
      operationType: savedOperationTypes[0],
      dietLevel: 0,
      label: 'Mức 0',
      mealsPerDayMin: null,
      mealsPerDayMax: null,
      mealInstruction:
        'Điều kiện bắt đầu:\n• Người bệnh tỉnh táo.\n• Huyết động ổn định.\n• Không nôn đang diễn biến.\n• Không có chống chỉ định uống.\n• Không có nguy cơ hít sặc rõ.\n• Được nhân viên y tế cho phép bắt đầu uống.\n\nHướng dẫn:\n• Mỗi lần: 10–20 ml.\n• Khoảng cách: 10–15 phút/lần.\n• Sau 3–4 lần dung nạp tốt, có thể tăng lên 20–30 ml/lần.\n• Không uống nhanh hoặc uống dồn.',
      volumnPerMealMin: 10,
      volumePerMealMax: 20,
      volumeInstruction:
        '10–20 ml/lần (khoảng cách 10–15 phút/lần). Sau 3–4 lần dung nạp tốt, có thể tăng lên 20–30 ml/lần.',
      recommendedFoods: [],
      recommendedDrinks: [
        'Nước ấm.',
        'Nước lọc.',
        'Nước cháo lọc.',
        'Nước canh hoặc nước súp trong.',
        'Dung dịch bù nước điện giải pha đúng hướng dẫn.',
        'Dung dịch dinh dưỡng trong nếu có chỉ định.',
      ],
      forbiddenFoods: [],
      forbiddenDrinks: [
        'Nước ngọt có gas.',
        'Rượu, bia.',
        'Nước trái cây quá ngọt hoặc quá chua.',
        'Đồ uống nhiều đường.',
        'Sữa nguyên kem nếu người bệnh dễ đầy bụng hoặc chưa được phép sử dụng.',
      ],
      upgradeCriteria: [
        'Uống được lượng hướng dẫn.',
        'Không nôn.',
        'Không buồn nôn ảnh hưởng đến uống.',
        'Không chướng bụng tăng.',
        'Không đau bụng tăng rõ sau uống.',
      ],
    },
    {
      operationType: savedOperationTypes[0],
      dietLevel: 1,
      label: 'Mức 1',
      mealsPerDayMin: 6,
      mealsPerDayMax: 8,
      mealInstruction:
        'Hướng dẫn:\n• Chia 6–8 lần/ngày.\n• Mỗi lần khoảng 30–50 ml.\n• Tổng lượng từ thức ăn và đồ uống được tăng dần theo dung nạp; không ép người bệnh hoàn thành nếu xuất hiện khó chịu.\n• Ăn hoặc uống chậm, từng thìa hoặc từng ngụm.\n\nLưu ý riêng sau phẫu thuật dạ dày:\n• Không uống quá nhiều trong một lần.\n• Không ăn quá nhanh.\n• Không dùng đồ uống quá ngọt.\n• Theo dõi đầy bụng sớm, vã mồ hôi, hồi hộp, đau quặn hoặc tiêu chảy sau ăn.',
      volumnPerMealMin: 30,
      volumePerMealMax: 50,
      volumeInstruction: 'Mỗi lần khoảng 30–50 ml',
      recommendedFoods: [
        'Cháo lọc hoặc cháo xay rất loãng.',
        'Súp lọc.',
        'Nước thịt hoặc nước cá đã lọc.',
      ],
      recommendedDrinks: [
        'Sữa dinh dưỡng uống từng lượng nhỏ nếu được chỉ định.',
        'Sữa không lactose nếu người bệnh không dung nạp lactose.',
        'Dung dịch dinh dưỡng đường uống giàu đạm theo chỉ định.',
        'Nước điện giải.',
      ],
      forbiddenFoods: [
        'Không uống quá nhiều trong một lần.',
        'Không ăn quá nhanh.',
        'Không dùng đồ uống quá ngọt.',
        'Theo dõi đầy bụng sớm, vã mồ hôi, hồi hộp, đau quặn hoặc tiêu chảy sau ăn.',
      ],
      forbiddenDrinks: [],
      upgradeCriteria: [
        'Hoàn thành khoảng từ 75% mục tiêu của mức ăn hiện tại trở lên.',
        'Không nôn.',
        'Không buồn nôn hoặc chướng bụng ảnh hưởng rõ đến ăn uống.',
        'Không phải dừng ăn do khó chịu.',
        'Không có quyết định giữ hoặc lùi mức ăn của bác sĩ.',
      ],
    },
    {
      operationType: savedOperationTypes[0],
      dietLevel: 2,
      label: 'Mức 2',
      mealsPerDayMin: 6,
      mealsPerDayMax: 6,
      mealInstruction:
        'Hướng dẫn:\n• Chia 6 bữa nhỏ/ngày.\n• Mỗi lần khoảng 50–80 ml khi mới bắt đầu.\n• Nếu dung nạp tốt, có thể tăng dần nhưng thường không vượt quá 100 ml/lần trong giai đoạn đầu.\n• Không uống dồn lượng lớn trong bữa ăn.',
      volumnPerMealMin: 50,
      volumePerMealMax: 80,
      volumeInstruction: '50–80 ml/lần khi mới bắt đầu (không quá 100 ml/lần)',
      recommendedFoods: [
        'Cháo xay loãng có thịt, cá hoặc trứng xay.',
        'Súp xay nhuyễn.',
        'Khoai tây hoặc khoai lang nghiền loãng.',
        'Trứng hấp mềm, có thể nghiền nhỏ.',
        'Đậu phụ non.',
        'Sữa chua dạng mịn nếu dung nạp được.',
      ],
      recommendedDrinks: [
        'Sữa dinh dưỡng giàu năng lượng, giàu đạm.',
        'Sản phẩm dinh dưỡng y học đường uống nếu được bác sĩ dinh dưỡng chỉ định.',
      ],
      forbiddenFoods: [
        'Thức ăn nhiều dầu mỡ.',
        'Thức ăn nhiều đường đơn.',
        'Thức ăn có bã thô.',
        'Thực phẩm gây đầy hơi rõ.',
      ],
      forbiddenDrinks: ['Đồ uống có gas.'],
      upgradeCriteria: [
        'Ăn được từ 75% mục tiêu của mức hiện tại.',
        'Không nôn.',
        'Không chướng bụng nhiều.',
        'Không phải ngừng ăn do khó chịu.',
        'Không có biểu hiện không dung nạp rõ sau bữa ăn.',
      ],
    },
    {
      operationType: savedOperationTypes[0],
      dietLevel: 3,
      label: 'Mức 3',
      mealsPerDayMin: 5,
      mealsPerDayMax: 6,
      mealInstruction:
        'Hướng dẫn:\n• Chia 5–6 bữa nhỏ/ngày.\n• Mỗi bữa bắt đầu khoảng 80–120 g hoặc ml, tùy loại thực phẩm.\n• Tăng dần theo dung nạp.\n• Ăn chậm, nhai kỹ, dừng khi có cảm giác đầy.\n\nLưu ý:\n• Chưa bắt buộc ăn cơm.\n• Không ăn quá no.\n• Hạn chế uống nhiều cùng lúc với bữa ăn.\n• Tránh thức ăn khô, dai, nhiều xơ thô hoặc nhiều đường.',
      volumnPerMealMin: 80,
      volumePerMealMax: 120,
      volumeInstruction: '80–120 g hoặc ml mỗi bữa, tùy loại thực phẩm',
      recommendedFoods: [
        'Cháo xay đặc vừa.',
        'Súp đặc xay nhuyễn.',
        'Trứng hấp mềm.',
        'Thịt nạc xay hoặc băm thật nhỏ trộn trong cháo.',
        'Cá hấp nghiền nhỏ.',
        'Đậu phụ non.',
        'Khoai nghiền.',
        'Bí đỏ nghiền.',
      ],
      recommendedDrinks: ['Sữa hoặc sản phẩm dinh dưỡng đường uống theo chỉ định.'],
      forbiddenFoods: [
        'Thức ăn khô, dai, nhiều xơ thô.',
        'Thức ăn nhiều đường.',
        'Ăn quá no.',
        'Uống nhiều cùng lúc với bữa ăn.',
      ],
      forbiddenDrinks: [],
      upgradeCriteria: [
        'Ăn được từ 75% mục tiêu của mức hiện tại.',
        'Không nôn.',
        'Không đầy bụng hoặc đau bụng ảnh hưởng rõ đến ăn uống.',
        'Không xuất hiện triệu chứng gợi ý hội chứng dumping mức độ đáng kể.',
        'Bác sĩ không yêu cầu duy trì mức hiện tại.',
      ],
    },
    {
      operationType: savedOperationTypes[0],
      dietLevel: 4,
      label: 'Mức 4',
      mealsPerDayMin: 5,
      mealsPerDayMax: 6,
      mealInstruction:
        'Hướng dẫn:\n• Chia 5–6 bữa nhỏ/ngày; chưa chuyển ngay sang ba bữa lớn.\n• Mỗi bữa khoảng 100–150 g, tăng dần theo khả năng dung nạp.\n• Ưu tiên đạm ở mỗi bữa.\n• Ăn chậm và nhai kỹ.',
      volumnPerMealMin: 100,
      volumePerMealMax: 150,
      volumeInstruction: '100–150 g mỗi bữa, tăng dần theo khả năng dung nạp',
      recommendedFoods: [
        'Cháo đặc.',
        'Cơm rất mềm hoặc cơm nhão với lượng nhỏ.',
        'Mì, bún hoặc nui nấu mềm.',
        'Cá hấp mềm.',
        'Thịt nạc băm hoặc hầm mềm.',
        'Trứng.',
        'Đậu phụ.',
        'Rau củ hầm nhừ, nghiền hoặc cắt nhỏ.',
      ],
      recommendedDrinks: ['Sữa dinh dưỡng nếu khẩu phần thông thường chưa đáp ứng đủ.'],
      forbiddenFoods: [
        'Thức ăn chiên rán.',
        'Đồ quá cay.',
        'Thức ăn dai, khô hoặc nhiều xơ thô.',
        'Ăn quá nhanh hoặc quá no.',
      ],
      forbiddenDrinks: ['Đồ uống có gas.', 'Đồ ngọt đậm đặc.'],
      upgradeCriteria: [
        'Ăn dung nạp tốt chế độ ăn mềm.',
        'Không nôn, không chướng bụng.',
        'Đạt mục tiêu dinh dưỡng đường miệng chuẩn bị xuất viện.',
      ],
    },
    // Colorectal Pathway (OperationType 2 - Phẫu thuật Đại trực tràng / Tiêu hóa dưới)
    {
      operationType: savedOperationTypes[1],
      dietLevel: 0,
      label: 'Mức 0',
      mealsPerDayMin: null,
      mealsPerDayMax: null,
      mealInstruction:
        'Điều kiện bắt đầu:\n• Tỉnh táo.\n• Huyết động ổn định.\n• Không nguy cơ hít sặc.\n• Không có chống chỉ định.\n• Được nhân viên y tế cho phép.\n\nHướng dẫn:\n• Mỗi lần 20–30 ml.\n• Cách nhau 10–15 phút.\n• Nếu dung nạp tốt, tăng dần lên 30–50 ml/lần.',
      volumnPerMealMin: 20,
      volumePerMealMax: 30,
      volumeInstruction:
        '20–30 ml/lần (mỗi 10–15 phút). Tăng dần lên 30–50 ml/lần nếu dung nạp tốt.',
      recommendedFoods: [],
      recommendedDrinks: [
        'Nước ấm hoặc nước lọc.',
        'Nước cháo lọc.',
        'Canh hoặc súp trong.',
        'Dung dịch điện giải.',
        'Đồ uống dinh dưỡng trong hoặc sản phẩm dinh dưỡng đường uống theo chỉ định.',
      ],
      forbiddenFoods: [],
      forbiddenDrinks: ['Nước có gas.', 'Rượu, bia.', 'Đồ uống nhiều đường.'],
      upgradeCriteria: [
        'Không nôn.',
        'Không chướng bụng tăng rõ.',
        'Không đau bụng tăng.',
        'Uống được lượng dự kiến.',
      ],
    },
    {
      operationType: savedOperationTypes[1],
      dietLevel: 1,
      label: 'Mức 1',
      mealsPerDayMin: 5,
      mealsPerDayMax: 6,
      mealInstruction:
        'Hướng dẫn:\n• Chia 5–6 bữa nhỏ/ngày.\n• Mỗi lần khoảng 50–80 ml.\n• Có thể tăng dần đến khoảng 100 ml/lần nếu dung nạp tốt.',
      volumnPerMealMin: 50,
      volumePerMealMax: 80,
      volumeInstruction: '50–80 ml/lần (tăng dần đến 100 ml/lần nếu dung nạp tốt)',
      recommendedFoods: [
        'Cháo loãng.',
        'Cháo xay loãng.',
        'Súp.',
        'Trứng hấp loãng.',
        'Nước cháo, canh hoặc súp trong.',
        'Sữa chua mịn nếu dung nạp được.',
      ],
      recommendedDrinks: ['Sữa dinh dưỡng.', 'Sản phẩm dinh dưỡng đường uống giàu đạm.'],
      forbiddenFoods: ['Thức ăn đặc, thô.', 'Thức ăn nhiều dầu mỡ.'],
      forbiddenDrinks: ['Nước có gas.', 'Rượu, bia.'],
      upgradeCriteria: [
        'Ăn được từ 75% mục tiêu của mức hiện tại.',
        'Không nôn.',
        'Không chướng bụng nhiều.',
        'Không đau bụng tăng rõ sau ăn.',
        'Không có quyết định chuyên môn yêu cầu duy trì mức.',
      ],
    },
    {
      operationType: savedOperationTypes[1],
      dietLevel: 2,
      label: 'Mức 2',
      mealsPerDayMin: 5,
      mealsPerDayMax: 6,
      mealInstruction:
        'Hướng dẫn:\n• Chia 5–6 bữa/ngày.\n• Mỗi lần khoảng 80–120 ml hoặc g.\n• Tăng dần theo dung nạp.',
      volumnPerMealMin: 80,
      volumePerMealMax: 120,
      volumeInstruction: '80–120 ml hoặc g mỗi bữa',
      recommendedFoods: [
        'Cháo xay vừa.',
        'Súp đặc.',
        'Cháo thịt hoặc cá xay.',
        'Khoai nghiền.',
        'Bí đỏ nghiền.',
        'Trứng hấp mềm.',
        'Đậu phụ non.',
      ],
      recommendedDrinks: [
        'Sữa giàu năng lượng, giàu đạm.',
        'Sản phẩm dinh dưỡng y học đường uống nếu được chỉ định.',
      ],
      forbiddenFoods: ['Thực phẩm chiên xào nhiều dầu mỡ.', 'Thức ăn có bã xơ cứng.'],
      forbiddenDrinks: ['Nước có gas.', 'Rượu, bia.'],
      upgradeCriteria: [
        'Ăn được từ 75% mục tiêu.',
        'Không nôn.',
        'Không chướng bụng ảnh hưởng đến ăn uống.',
        'Không phải dừng bữa do khó chịu.',
        'Không có chống chỉ định tiến triển chế độ ăn.',
      ],
    },
    {
      operationType: savedOperationTypes[1],
      dietLevel: 3,
      label: 'Mức 3',
      mealsPerDayMin: 4,
      mealsPerDayMax: 5,
      mealInstruction:
        'Hướng dẫn:\n• Chia 4–5 bữa/ngày.\n• Mỗi bữa khoảng 100–150 g.\n• Tăng dần theo khả năng dung nạp.\n\nLưu ý:\n• Chưa bắt buộc chuyển sang cơm.\n• Tránh thực phẩm nhiều dầu mỡ.\n• Hạn chế thực phẩm sinh hơi nếu người bệnh chướng bụng.\n• Điều chỉnh chất xơ theo tình trạng đại tiện và chỉ định chuyên môn.',
      volumnPerMealMin: 100,
      volumePerMealMax: 150,
      volumeInstruction: '100–150 g mỗi bữa',
      recommendedFoods: [
        'Cháo đặc mềm.',
        'Mì hoặc nui nấu mềm.',
        'Trứng hấp.',
        'Cá hấp mềm.',
        'Thịt nạc băm hoặc xay.',
        'Đậu phụ.',
        'Khoai nghiền.',
        'Rau củ nấu nhừ, nghiền hoặc cắt nhỏ.',
      ],
      recommendedDrinks: ['Sữa dinh dưỡng.'],
      forbiddenFoods: [
        'Thực phẩm nhiều dầu mỡ.',
        'Thực phẩm sinh hơi nếu người bệnh chướng bụng.',
        'Tránh thức ăn khô, dai, nhiều xơ thô.',
      ],
      forbiddenDrinks: ['Nước có gas.', 'Rượu, bia.'],
      upgradeCriteria: [
        'Ăn được từ 75% mục tiêu.',
        'Không nôn.',
        'Không chướng bụng nhiều.',
        'Không đau bụng tăng rõ.',
      ],
    },
    {
      operationType: savedOperationTypes[1],
      dietLevel: 4,
      label: 'Mức 4',
      mealsPerDayMin: 4,
      mealsPerDayMax: 5,
      mealInstruction:
        'Hướng dẫn:\n• 3 bữa chính và 1–2 bữa phụ.\n• Mỗi bữa khoảng 150–200 g, tùy khả năng dung nạp.\n• Tăng dần lượng ăn; không bắt buộc phải ăn hết nếu xuất hiện triệu chứng.',
      volumnPerMealMin: 150,
      volumePerMealMax: 200,
      volumeInstruction: '150–200 g mỗi bữa',
      recommendedFoods: [
        'Cơm mềm hoặc cơm nát với lượng vừa.',
        'Cháo đặc.',
        'Bún, phở, mì hoặc nui nấu mềm.',
        'Cá hấp.',
        'Thịt nạc hầm mềm hoặc băm nhỏ.',
        'Trứng.',
        'Đậu phụ.',
        'Rau củ nấu mềm.',
      ],
      recommendedDrinks: ['Sữa hoặc sản phẩm dinh dưỡng đường uống khi khẩu phần chưa đủ.'],
      forbiddenFoods: [
        'Thức ăn chiên rán.',
        'Thức ăn quá cay.',
        'Thức ăn khó tiêu hoặc nhiều xơ thô trong giai đoạn đầu.',
        'Thực phẩm gây đầy hơi rõ ở từng người bệnh.',
      ],
      forbiddenDrinks: ['Đồ uống có gas.', 'Rượu, bia.'],
      upgradeCriteria: [
        'Ăn dung nạp tốt chế độ ăn mềm.',
        'Không nôn, không chướng bụng.',
        'Đạt mục tiêu dinh dưỡng chuẩn bị xuất viện.',
      ],
    },
  ];

  await podProtocolsRepository.save(podProtocols);
  log(`✅ ${podProtocols.length} PodProtocols (Diet Guidance) seeded`);

  const now = new Date();

  const patientCases: (DeepPartial<Patient> & { assessmentTimeAgo: number })[] = [
    {
      caseId: 'CASE-001',
      age: 55,
      gender: 'Nam',
      height: 168,
      weight: 62,
      bmi: 22.0,
      diagnosis: 'K56.6 - Tắc nghẽn ruột khác và/hoặc không xác định',
      comorbidities: ['K76.0 - Gan (biến đổi của gan) nhiễm mỡ, không phân loại mục khác'],
      operationType: savedOperationTypes[1],
      method: 'Nội soi cắt đại tràng phải, nối hồi - đại tràng',
      hasGiAnastomosis: true,
      surgeryDate: formatISO(subDays(now, 2), { representation: 'date' }),
      guardianPhone: '0915382467',
      roomBed: 'P502',
      currentPod: 2,
      currentDietLevel: 2,
      podStartDate: formatISO(subDays(now, 2), { representation: 'date' }),
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
      diagnosis: 'K25.4 - Loét dạ dày, mạn tính hoặc không xác định kèm xuất huyết',
      comorbidities: ['K29.5 - Viêm dạ dày mạn tính, không xác định'],
      operationType: savedOperationTypes[0],
      method: 'Mổ mở khâu cầm máu ổ loét dạ dày',
      hasGiAnastomosis: false,
      surgeryDate: formatISO(subDays(now, 1), { representation: 'date' }),
      guardianPhone: '0983614250',
      roomBed: 'P502',
      currentPod: 1,
      currentDietLevel: 1,
      podStartDate: formatISO(subDays(now, 1), { representation: 'date' }),
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
      diagnosis: 'K63.5 - Polyp đại tràng',
      comorbidities: [
        'K80.2 - Sỏi túi mật không kèm viêm túi mật',
        'K76.0 - Gan (biến đổi của gan) nhiễm mỡ, không phân loại mục khác',
      ],
      operationType: savedOperationTypes[1],
      method: 'Nội soi cắt đoạn đại tràng sigma',
      hasGiAnastomosis: true,
      surgeryDate: formatISO(subDays(now, 3), { representation: 'date' }),
      guardianPhone: '0904227891',
      roomBed: 'P502',
      currentPod: 3,
      currentDietLevel: 2,
      podStartDate: formatISO(subDays(now, 3), { representation: 'date' }),
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
      diagnosis: 'K31.1 - Hẹp môn vị do phì đại ở người lớn',
      comorbidities: ['K21.9 - Bệnh trào ngược dạ dày -thực quản không kèm viêm thực quản'],
      operationType: savedOperationTypes[0],
      method: 'Nội soi nối vị - tràng',
      hasGiAnastomosis: true,
      surgeryDate: formatISO(subDays(now, 2), { representation: 'date' }),
      guardianPhone: '0962745318',
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
      diagnosis: 'K57.2 - Bệnh túi thừa của đại tràng có thủng và/hoặc áp xe',
      comorbidities: ['K64.9 - Bệnh trĩ, không xác định'],
      operationType: savedOperationTypes[1],
      method: 'Mổ mở cắt đại tràng sigma, làm hậu môn nhân tạo (Hartmann)',
      hasGiAnastomosis: false,
      surgeryDate: formatISO(subDays(now, 4), { representation: 'date' }),
      guardianPhone: '0932509164',
      roomBed: 'P504',
      currentPod: 4,
      podStartDate: formatISO(subDays(now, 4), { representation: 'date' }),
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
      diagnosis: 'K25.5 - Loét dạ dày, mạn tính hoặc không xác định kèm thủng',
      comorbidities: [],
      operationType: savedOperationTypes[0],
      method: 'Nội soi khâu lỗ thủng ổ loét dạ dày',
      hasGiAnastomosis: false,
      surgeryDate: formatISO(subDays(now, 1), { representation: 'date' }),
      guardianPhone: '0971836402',
      roomBed: 'P504',
      currentPod: 1,
      podStartDate: formatISO(subDays(now, 1), { representation: 'date' }),
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
      diagnosis: 'K62.1 - Polyp trực tràng',
      comorbidities: [
        'K64.9 - Bệnh trĩ, không xác định',
        'K76.0 - Gan (biến đổi của gan) nhiễm mỡ, không phân loại mục khác',
      ],
      operationType: savedOperationTypes[1],
      method: 'Mổ mở cắt trước thấp trực tràng',
      hasGiAnastomosis: true,
      surgeryDate: formatISO(subDays(now, 5), { representation: 'date' }),
      guardianPhone: '0913470928',
      roomBed: 'P506',
      currentPod: 5,
      podStartDate: formatISO(subDays(now, 5), { representation: 'date' }),
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
      diagnosis: 'K31.1 - Hẹp môn vị do phì đại ở người lớn',
      comorbidities: [],
      operationType: savedOperationTypes[0],
      method: 'Nội soi cắt hang vị, nối vị - tá tràng',
      hasGiAnastomosis: true,
      surgeryDate: formatISO(now, { representation: 'date' }),
      guardianPhone: '0349218657',
      roomBed: 'P506',
      currentPod: 0,
      podStartDate: formatISO(now, { representation: 'date' }),
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
      diagnosis: 'K50.1 - Bệnh Crohn của đại tràng',
      comorbidities: ['K92.2 - Xuất huyết tiêu hóa [phân đen], không xác định'],
      operationType: savedOperationTypes[1],
      method: 'Nội soi cắt đại tràng phải',
      hasGiAnastomosis: true,
      surgeryDate: formatISO(subDays(now, 3), { representation: 'date' }),
      guardianPhone: '0387652019',
      roomBed: 'P506',
      currentPod: 3,
      podStartDate: formatISO(subDays(now, 3), { representation: 'date' }),
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
      diagnosis: 'K92.2 - Xuất huyết tiêu hóa [phân đen], không xác định',
      comorbidities: [
        'K29.5 - Viêm dạ dày mạn tính, không xác định',
        'K80.2 - Sỏi túi mật không kèm viêm túi mật',
      ],
      operationType: savedOperationTypes[0],
      method: 'Mổ mở cắt bán phần dưới dạ dày',
      hasGiAnastomosis: true,
      surgeryDate: formatISO(subDays(now, 4), { representation: 'date' }),
      guardianPhone: '0856103794',
      roomBed: 'P506',
      currentPod: 4,
      podStartDate: formatISO(subDays(now, 4), { representation: 'date' }),
      assignedNurse: savedUsers[2],
      assessmentTimeAgo: 28,
      level: Levels.GREEN,
    },
  ];

  const savedPatientCases = await patientsRepository.save(patientCases);
  log('✅ 10 patient cases seeded with ERAS started + assessment completed');
  log('   - Room distribution: P502(3), P504(3), P506(4)');
  log('   - Level distribution: Red(3), Yellow(3), Green(4)');

  // Bảng phân bổ thứ tự diễn tiến triage color cho các ngày lịch sử hậu phẫu (POD 0 -> currentPod)
  const historyProgression: Record<string, string[]> = {
    'CASE-001': ['Green', 'Green', 'Yellow'],
    'CASE-002': ['Yellow', 'Green'],
    'CASE-003': ['Green', 'Yellow', 'Yellow', 'Red'],
    'CASE-004': ['Yellow', 'Green', 'Green'],
    'CASE-005': ['Green', 'Green', 'Yellow', 'Green', 'Yellow'],
    'CASE-006': ['Yellow', 'Red'],
    'CASE-007': ['Yellow', 'Yellow', 'Green', 'Green', 'Green', 'Green'],
    'CASE-008': ['Yellow'],
    'CASE-009': ['Green', 'Yellow', 'Yellow', 'Red'],
    'CASE-010': ['Red', 'Yellow', 'Yellow', 'Green', 'Green'],
  };

  const symptomSurveys: DeepPartial<SymptomSurvey>[] = [];

  for (const patient of savedPatientCases) {
    const caseId = patient.caseId;
    const maxPod = patient.currentPod ?? 0;
    const progression = historyProgression[caseId] ?? [];

    for (let pod = 0; pod <= maxPod; pod++) {
      const isCurrentPod = pod === maxPod;
      const triageColor = pod < progression.length ? progression[pod] : patient.level!.levelName;

      let evalDate: Date;
      if (isCurrentPod) {
        evalDate = subMinutes(now, patient.assessmentTimeAgo);
      } else {
        const pastDaysAgo = maxPod - pod;
        const pastDay = subDays(now, pastDaysAgo);
        pastDay.setHours(20, 0, 0, 0);
        evalDate = pastDay;
      }

      symptomSurveys.push({
        caseId: caseId,
        evaluationDatetime: evalDate,
        podContext: pod,
        triageColor: triageColor,
        // DailyDietProgressionSchedulerService only accepts this canonical
        // uppercase snapshot, not the display-cased triageColor above.
        triageVerdictSnapshot: triageColor.toUpperCase(),
        source: 'SURVEY',
        questionnaireVersionId: DEFAULT_QUESTIONNAIRE_VERSION_ID,
      });

      log(
        `   ✅ Assessment for ${caseId} (POD ${pod}): ${triageColor} at ${evalDate.toISOString()}`,
      );
    }
  }

  const savedSurveys = await symptomSurveysRepository.save(symptomSurveys);
  log(`✅ ${savedSurveys.length} patient assessments seeded across POD 0 to current POD`);

  // Seed AssessmentDetails cho toàn bộ các bài đánh giá khảo sát để hiện đúng trên bảng Tuân thủ (Compliance Matrix)
  const assessmentDetailsRepository = dataSource.getRepository(AssessmentDetail);
  const surveyQuestionsRepository = dataSource.getRepository(SurveyQuestion);

  const questions = await surveyQuestionsRepository.find({
    relations: ['options'],
    order: { orderNumber: 'ASC' },
  });

  const detailsToSave: DeepPartial<AssessmentDetail>[] = [];

  for (const survey of savedSurveys) {
    const triage = String(survey.triageColor ?? 'Green').toUpperCase();

    for (const q of questions) {
      if (!q.options || q.options.length === 0) continue;

      const sortedOptions = [...q.options].sort(
        (a, b) => (a.normalizedValue ?? 0) - (b.normalizedValue ?? 0),
      );

      let selectedOption: QuestionOption;
      if (triage === 'GREEN') {
        selectedOption = sortedOptions[0];
      } else if (triage === 'YELLOW') {
        selectedOption = sortedOptions[Math.min(1, sortedOptions.length - 1)];
      } else {
        selectedOption = sortedOptions[sortedOptions.length - 1];
      }

      detailsToSave.push({
        assessmentId: survey.assessmentId,
        questionId: q.questionId,
        selectedOptionId: selectedOption.optionId,
        questionTextSnapshot: q.questionText,
        optionTextSnapshot: selectedOption.optionText,
        clinicalDimensionSnapshot: q.clinicalDimension ?? '',
        optionTriageLevelSnapshot: selectedOption.optionTriageLevel ?? '',
        normalizedValueSnapshot: selectedOption.normalizedValue ?? null,
      });
    }
  }

  if (detailsToSave.length > 0) {
    await assessmentDetailsRepository.save(detailsToSave);
    log(`✅ ${detailsToSave.length} assessment question details seeded for compliance matrix`);
  }

  // Seed Room Nurse Assignments for nurse01 (ID 3) -> P502, P504
  await queryRunner.query(`TRUNCATE TABLE "room_nurse_assignments" CASCADE;`);
  await queryRunner.query(`
    INSERT INTO "room_nurse_assignments" ("room_code", "nurse_user_id", "assigned_at")
    VALUES 
      ('P502', 3, NOW()),
      ('P504', 3, NOW())
    ON CONFLICT DO NOTHING;
  `);
  log('✅ Room assignments seeded (nurse01 -> P502, P504)');

  await queryRunner.release();
  if (closeConnection) {
    await dataSource.destroy();
  }
  log('🎉 Seed completed!');
}

if (require.main === module) {
  seed().catch((err) => {
    console.error('❌ Seed failed:', err);
    process.exit(1);
  });
}
