/**
 * @filename: lint-staged.config.mjs
 * @type {import('lint-staged').Configuration}
 */
export default {
  'package.json': ['sort-package-json'],
  '*.{ts,tsx,js,jsx}': ['biome check --write'],
};
