module.exports = [
  {
    ignores: ['eslint.config.js'],
  },
  {
    files: ['src/**/*.js'],
    rules: {
      semi: ['error', 'always'],
      'prefer-const': 'error',
    },
  },
];
