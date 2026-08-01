import { type StartedPostgreSqlContainer } from '@testcontainers/postgresql';

declare global {
  var __POSTGRES_CONTAINER__: StartedPostgreSqlContainer | undefined;
  var __TEST_START_TIME__: number | undefined;

  namespace NodeJS {
    interface ProcessEnv {
      NODE_ENV: 'development' | 'production' | 'test';
      TEST_DB_URL?: string;
      DATABASE_URL?: string;
      JWT_SECRET?: string;
    }
  }
}

export {};
