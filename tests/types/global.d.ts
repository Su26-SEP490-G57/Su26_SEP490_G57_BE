import { type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { type StartedTestContainer } from 'testcontainers';

declare global {
  var __POSTGRES_CONTAINER__: StartedPostgreSqlContainer | undefined;
  var __REDIS_CONTAINER__: StartedTestContainer | undefined;
  var __TEST_START_TIME__: number | undefined;

  namespace NodeJS {
    interface ProcessEnv {
      NODE_ENV: 'development' | 'production' | 'test';
      TEST_DB_URL?: string;
      REDIS_HOST?: string;
      REDIS_PORT?: string;
      REDIS_PASSWORD?: string;
      DATABASE_URL?: string;
      JWT_SECRET?: string;
    }
  }
}

export {};
