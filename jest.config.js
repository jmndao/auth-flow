module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  roots: ['<rootDir>/tests'],
  testMatch: ['<rootDir>/tests/**/*.test.+(ts|tsx|js)', '<rootDir>/tests/**/*.spec.+(ts|tsx|js)'],
  testPathIgnorePatterns: ['<rootDir>/tests/setup.ts'],
  transform: {
    '^.+\\.(ts|tsx)$': [
      'ts-jest',
      {
        tsconfig: 'tsconfig.jest.json',
      },
    ],
  },
  collectCoverageFrom: [
    'adapters/**/*.{ts,tsx}',
    'core/**/*.{ts,tsx}',
    'types/**/*.{ts,tsx}',
    'utils/**/*.{ts,tsx}',
    'index.ts',
    '!**/*.d.ts',
    '!node_modules/**',
    '!dist/**',
    '!coverage/**',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
  testEnvironmentOptions: {
    url: 'http://localhost',
  },
  clearMocks: true,
  restoreMocks: true,
};
