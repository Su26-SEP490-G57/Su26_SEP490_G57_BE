import { Config } from 'jest';

export default {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '..',
  modulePaths: ['<rootDir>'],
  testMatch: ['<rootDir>/tests/**/*.test.ts', '<rootDir>/tests/**/*.spec.ts'],
  testPathIgnorePatterns: ['/node_modules/', '\\.e2e-spec\\.ts$'],
  bail: 1,
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
  coverageDirectory: 'coverage/unit',
  testEnvironment: 'node',
} satisfies Config;
