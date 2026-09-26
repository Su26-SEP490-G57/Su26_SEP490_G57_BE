import { PostgreSqlContainer } from '@testcontainers/postgresql';
import { GenericContainer, Wait } from 'testcontainers';

export default async () => {
  process.env.FIREBASE_DISABLED = 'true';
  console.log('\n🚀 Starting Global Postgres + Redis Testcontainers...');

  // Bull queues (e.g. the YELLOW alert reminder) need a live Redis: without one,
  // queue.add() never settles and any request that creates a YELLOW alert hangs.
  const [postgres, redis] = await Promise.all([
    new PostgreSqlContainer('postgres:16-alpine')
      .withDatabase('poms_test')
      .withUsername('test_user')
      .withPassword('test_pass')
      .start(),
    new GenericContainer('redis:7-alpine')
      .withExposedPorts(6379)
      .withWaitStrategy(Wait.forLogMessage('Ready to accept connections'))
      .start(),
  ]);

  process.env.TEST_DB_URL = postgres.getConnectionUri();
  process.env.REDIS_HOST = redis.getHost();
  process.env.REDIS_PORT = String(redis.getMappedPort(6379));
  process.env.REDIS_PASSWORD = '';

  global.__POSTGRES_CONTAINER__ = postgres;
  global.__REDIS_CONTAINER__ = redis;
};
