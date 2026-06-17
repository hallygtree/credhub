/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.test.ts'],
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  transform: {
    '^.+\\.ts$': ['ts-jest', {
      useESM: false,
      tsconfig: {
        module: 'commonjs',
        moduleResolution: 'node',
        target: 'ES2022',
        esModuleInterop: true,
        strict: true,
        skipLibCheck: true,
        noUnusedLocals: false,
        noUnusedParameters: false,
      },
    }],
  },
  testTimeout: 30000,
};
