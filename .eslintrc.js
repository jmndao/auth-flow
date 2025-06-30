module.exports = {
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint', 'prettier'],
  extends: ['eslint:recommended', 'prettier'],
  parserOptions: {
    ecmaVersion: 2020,
    sourceType: 'module',
    project: './tsconfig.json',
  },
  env: {
    node: true,
    es6: true,
    browser: true,
  },
  rules: {
    'prettier/prettier': 'error',
    '@typescript-eslint/no-unused-vars': [
      'error',
      {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
      },
    ],
    'no-undef': 'off',
    'no-unused-vars': 'off', // Use TypeScript version instead
  },
  overrides: [
    {
      files: ['**/*.test.ts', '**/*.spec.ts', 'tests/**/*.ts'],
      parserOptions: {
        project: './tsconfig.jest.json',
      },
      env: {
        jest: true,
        browser: true,
      },
      rules: {
        '@typescript-eslint/no-unused-vars': 'off',
        'no-undef': 'off',
      },
    },
  ],
};
