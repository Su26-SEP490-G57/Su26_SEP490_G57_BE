import 'dotenv/config';
import AppDataSource from '../../data-source';
import { PodProtocol } from '../../modules/diet-guidance/entities/pod-protocol.entity';
import { OperationType } from '../../modules/patient/entities/operation-type.entity';

async function updateProtocols() {
  console.log('🔄 Connecting to Database...');
  await AppDataSource.initialize();

  const podRepo = AppDataSource.getRepository(PodProtocol);
  const opTypeRepo = AppDataSource.getRepository(OperationType);

  const opTypes = await opTypeRepo.find();
  const gastricOp = opTypes.find(
    (o) => o.operationTypeId === 1 || o.operationName.includes('dạ dày'),
  );
  const colorectalOp = opTypes.find(
    (o) => o.operationTypeId === 2 || o.operationName.includes('đại trực tràng'),
  );

  if (!gastricOp) {
    console.error('❌ Gastric Operation Type not found');
    process.exit(1);
  }

  const gastricProtocols = [
    {
      operationTypeId: gastricOp.operationTypeId,
      dietLevel: 0,
      label: 'Bắt đầu uống',
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
      operationTypeId: gastricOp.operationTypeId,
      dietLevel: 1,
      label: 'Lỏng lượng nhỏ',
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
      operationTypeId: gastricOp.operationTypeId,
      dietLevel: 2,
      label: 'Lỏng đầy đủ dinh dưỡng',
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
      operationTypeId: gastricOp.operationTypeId,
      dietLevel: 3,
      label: 'Bán lỏng hoặc bán đặc mềm',
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
      operationTypeId: gastricOp.operationTypeId,
      dietLevel: 4,
      label: 'Chế độ ăn mềm',
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
  ];

  for (const item of gastricProtocols) {
    const existing = await podRepo.findOne({
      where: { operationTypeId: item.operationTypeId, dietLevel: item.dietLevel },
    });
    if (existing) {
      Object.assign(existing, item);
      await podRepo.save(existing);
      console.log(`✅ Updated Gastric Diet Level ${item.dietLevel}: ${item.label}`);
    } else {
      const created = podRepo.create(item);
      await podRepo.save(created);
      console.log(`✅ Created Gastric Diet Level ${item.dietLevel}: ${item.label}`);
    }
  }

  if (colorectalOp) {
    const colorectalProtocols = [
      {
        operationTypeId: colorectalOp.operationTypeId,
        dietLevel: 0,
        label: 'Bắt đầu uống',
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
        operationTypeId: colorectalOp.operationTypeId,
        dietLevel: 1,
        label: 'Chế độ ăn lỏng',
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
        operationTypeId: colorectalOp.operationTypeId,
        dietLevel: 2,
        label: 'Lỏng đầy đủ hoặc bán lỏng',
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
        operationTypeId: colorectalOp.operationTypeId,
        dietLevel: 3,
        label: 'Bán đặc mềm',
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
        operationTypeId: colorectalOp.operationTypeId,
        dietLevel: 4,
        label: 'Chế độ ăn mềm',
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

    for (const item of colorectalProtocols) {
      const existing = await podRepo.findOne({
        where: { operationTypeId: item.operationTypeId, dietLevel: item.dietLevel },
      });
      if (existing) {
        Object.assign(existing, item);
        await podRepo.save(existing);
        console.log(`✅ Updated Colorectal Diet Level ${item.dietLevel}: ${item.label}`);
      } else {
        const created = podRepo.create(item);
        await podRepo.save(created);
        console.log(`✅ Created Colorectal Diet Level ${item.dietLevel}: ${item.label}`);
      }
    }
  }

  await AppDataSource.destroy();
  console.log('🎉 Protocols update completed successfully!');
}

updateProtocols().catch((err) => {
  console.error('❌ Error updating protocols:', err);
  process.exit(1);
});
