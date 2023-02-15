if (process.env.NODE_PATH) {
  console.log('do some push');
  require.resolve.paths(process.env.NODE_PATH);
}
const { ESLint } = require('./infra/node_modules/eslint/lib/api');

console.log(process.env);
(async function main() {
  // 1. Create an instance.
  const eslint = new ESLint();

  // 2. Lint files.
  console.log('entry');
  const results = await eslint.lintText('class Person {}; \n new Person();');

  console.log('after entry');
  // 4. Output it.
  console.log(results);
})().catch((error) => {
  process.exitCode = 1;
  console.error(error);
});
