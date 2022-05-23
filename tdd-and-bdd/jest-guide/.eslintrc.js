/** @type {import('eslint').Linter.Config} */
const config = {
  root: true,
  env: {
    browser: true,
    node: true,
  },
  plugins: [],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:jest/recommended',
    'plugin:testing-library/recommended',
    'plugin:prettier/recommended',
  ],
  rules: {
    '@typescript-eslint/no-non-null-assertion': 'off',
    '@typescript-eslint/no-explicit-any': 'off',
    'no-var': 'off',
    '@typescript-eslint/no-var-requires': 'off',
    'testing-library/no-dom-import': 'off',

    'jest/no-focused-tests': 'error',
    'jest/no-identical-title': 'error',
    'jest/valid-expect': 'error',
    'testing-library/await-async-query': 'error',
    'testing-library/no-await-sync-query': 'error',

    'jest/no-disabled-tests': 'warn',
    'jest/prefer-to-have-length': 'warn',
    'testing-library/no-debugging-utils': 'warn',
  },
};

module.exports = config;
