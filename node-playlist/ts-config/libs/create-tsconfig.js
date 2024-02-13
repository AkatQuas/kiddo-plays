// @ts-check
const ts = require('typescript');
// Create a new TypeScript compiler host
/**
 * @type {import('typescript').CompilerOptions}
 */
const compilerOptions = {
  target: ts.ScriptTarget.ES2018,
  module: ts.ModuleKind.CommonJS,
  outDir: 'dist',
};

const host = ts.createCompilerHost(compilerOptions);

// Create a new TypeScript program
const program = ts.createProgram(['src/index.ts'], compilerOptions, host);

// Get the parsed JSON of the default compiler options
const defaultCompilerOptions = ts.getDefaultCompilerOptions();

const programCompilerOptions = program.getCompilerOptions();
// Merge the custom compiler options with the default options
const mergedCompilerOptions = {
  ...defaultCompilerOptions,
  ...programCompilerOptions,
};

// Create the tsconfig object
const tsconfig = {
  compilerOptions: mergedCompilerOptions,
  include: ['src'],
};
console.debug(
  '\x1B[97;100;1m --- create new tsconfig --- \x1B[m',
  '\n',
  tsconfig
);
