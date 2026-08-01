import { PostgreSqlContainer } from '@testcontainers/postgresql';

export default async () => {
  console.log('\n🚀 Starting Global Postgres Testcontainer...');

  const container = await new PostgreSqlContainer('postgres:16-alpine')
    .withDatabase('poms_test')
    .withUsername('test_user')
    .withPassword('test_pass')
    .start();

  process.env.TEST_DB_URL = container.getConnectionUri();

  global.__POSTGRES_CONTAINER__ = container;
};
