import { Config } from 'jest';

export default {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '..',
  modulePaths: ['<rootDir>'],
  testMatch: ['<rootDir>/tests/**/*.e2e-spec.ts'],
  // All integration spec files share one Postgres testcontainer (tests/global/db-context.ts).
  // Running spec files in parallel workers races on schema sync and DB resets, so force serial execution.
  maxWorkers: 1,
  transform: {
    '^.+\\.(t|j)s$': 'ts-jest',
  },
  collectCoverageFrom: [
    'src/modules/**/*.(t|j)s',
    '!src/modules/**/*.module.ts',
    '!src/modules/**/*.dto.ts',
    '!src/modules/**/*.entity.ts',
    '!src/modules/**/*.interface.ts',
    '!src/modules/**/index.ts',
  ],

  coverageDirectory: './coverage/e2e',
  globalSetup: '<rootDir>/tests/global/global-setup.ts',
  globalTeardown: '<rootDir>/tests/global/global-teardown.ts',
  testEnvironment: 'node',
} satisfies Config;
