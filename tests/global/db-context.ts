import { Level } from 'src/modules/patient/entities/level.entity';
import { seed } from 'src/database/seeds/seed';
import { DataSource } from 'typeorm';
import { SnakeNamingStrategy } from 'typeorm-naming-strategies';

let testDataSource: DataSource;

// Level rows are "protected" reference data: production provisions them once via the
// EnsureLevelsData migration and seed.ts deliberately never truncates/reseeds this table.
// The test DataSource only synchronizes the schema (no migrations run), so a fresh
// testcontainer starts with an empty levels table — replicate the migration's baseline
// rows here once so patient fixtures (which FK into levels) don't fail to seed.
async function ensureLevelsSeeded(dataSource: DataSource) {
  const levelRepo = dataSource.getRepository(Level);
  const count = await levelRepo.count();
  if (count > 0) return;

  await levelRepo.save([
    {
      levelId: 1,
      levelName: 'Red',
      description: 'High risk - immediate attention required',
      sortOrder: 1,
    },
    {
      levelId: 2,
      levelName: 'Yellow',
      description: 'Moderate risk - monitor closely',
      sortOrder: 2,
    },
    { levelId: 3, levelName: 'Green', description: 'Low risk - stable', sortOrder: 3 },
  ]);
}

export async function getTestDataSource() {
  if (!testDataSource) {
    testDataSource = new DataSource({
      type: 'postgres',
      url: process.env.TEST_DB_URL,
      entities: [__dirname + '/../../src/**/*.entity{.ts,.js}'],
      synchronize: true,
      namingStrategy: new SnakeNamingStrategy(),
    });
    await testDataSource.initialize();
    await ensureLevelsSeeded(testDataSource);
  }
  return testDataSource;
}

export async function resetTestDataSource() {
  const dataSource = await getTestDataSource();
  await seed(dataSource, { closeConnection: false, verbose: false });
}

export async function closeTestDataSource() {
  if (testDataSource && testDataSource.isInitialized) {
    await testDataSource.destroy();
  }
}
