/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  // Speeds tests up. Deprecated, but the new version doesn't work (tests still very slow).
  globals: {
    'ts-jest': {
      isolatedModules: true,
    },
  },
};
