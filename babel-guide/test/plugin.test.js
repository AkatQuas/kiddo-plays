const pluginTester = require('babel-plugin-tester/pure').default;
const uselessPlugin = require('babel-plugin-replace-plugin');

/* Jest will take care of these cases. */

beforeAll(() => {
  /* do something to setup */
});

afterAll(() => {
  /* clean */
});

beforeEach(() => {
  /* before each test */
});
afterEach(() => {
  /* after each test */
});

pluginTester({
  plugin: uselessPlugin,
  // the code format matters
  // https://github.com/babel-utils/babel-plugin-tester/blob/master/README.md#prettier-formatter
  // fixtures: path.join(__dirname, 'fixtures'),
  pluginName: 'babel-plugin-replace-plugin',
  pluginOptions: {},
  babelOptions: {
    presets: [],
  },
  tests: [
    {
      title: 'use default configuration',
      code: 'const number = 1;',
      output: 'const not_number = 1;',
    },
    {
      title: 'sourceIdentifier use "num"',
      code: 'const num = 1;',
      output: 'const not_number = 1;',
      pluginOptions: {
        sourceIdentifier: 'num',
      },
    },
    {
      title: 'targetIdentifier use "number_target"',
      code: 'const number = 1;',
      output: 'const number_target = 1;',
      pluginOptions: {
        targetIdentifier: 'number_target',
      },
    },
    {
      title:
        'sourceIdentifier use "num" and targetIdentifier use "number_target"',
      code: 'const num = 1;',
      output: 'const number_target = 1;',
      pluginOptions: {
        sourceIdentifier: 'num',
        targetIdentifier: 'number_target',
      },
    },
    {
      title: 'replace object value when key is "abc"',
      code: 'const abc = { abc: 123 };',
      output: `const abc = {
  abc: "abc"
};`,
    },
  ],
});
