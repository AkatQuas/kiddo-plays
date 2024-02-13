// @ts-check
const ts = require('typescript');
/** @type {string} */
const configFileName = ts.findConfigFile(
  __dirname,
  ts.sys.fileExists,
  'tsconfig.node.json'
);
const configFile = ts.readConfigFile(configFileName, ts.sys.readFile);
const compilerOptions = ts.parseJsonConfigFileContent(
  configFile.config,
  ts.sys,
  './'
);
console.debug(
  '\x1B[97;100;1m --- compilerOptions from file --- \x1B[m',
  '\n',
  compilerOptions
);
const host = ts.createCompilerHost(compilerOptions.options);

// Create a new TypeScript program
const program = ts.createProgram(
  ['src/index.ts', 'tests/index.test.ts'],
  compilerOptions.options,
  host
);

// Create the tsconfig object
const tsconfig = {
  compilerOptions: {
    ...program.getCompilerOptions(),
    target: 'es6',
    module: 'commonjs',
  },
  exclude: compilerOptions.raw.exclude,
  include: compilerOptions.raw.include,
};
console.debug('\x1B[97;100;1m --- tsconfig --- \x1B[m', '\n', tsconfig);
