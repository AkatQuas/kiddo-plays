#!/usr/bin/env node

/*
 * This is only a simple template for CLI without any third-party libraries.
 *
 * Use at your own risk.
 */

'use strict';

const path = require('path');
const spawnSync = require('child_process').spawnSync;

// #region argv parse
const args = process.argv.slice(2);

/* the flag `help` */
if (args.includes('-h')) {
  args[args.indexOf('-h')] = '--help';
}

/* the flag `version` */
if (args.includes('-v')) {
  args[args.indexOf('-v')] = '--version';
}

// more argv flag to parse

/* for example, a flag `output` */
if (args.includes('-o')) {
  args[args.indexOf('-o')] = '--output';
}

/* for example, a flag `input` */
if (args.includes('-i')) {
  args[args.indexOf('-i')] = '--input';
}

/* for example, a flag `verbose`
  expecting args has `--verbose` */
// #endregion

// #region global variables
let /** @type {string} */ input;
let /** @type {string} */ output;
let /** @type {boolean} */ verbose = false;

if (args.includes('--input')) {
  const inputIndex = args.indexOf('--input');
  const nextItem = args[inputIndex + 1];
  // maybe a value provided
  if (nextItem && nextItem[0] !== '-') {
    input = nextItem;
  } else {
    // read input from parameter
  }
}

if (args.includes('--output')) {
  const outputIndex = args.indexOf('--output') + 1;
  const nextItem = args[outputIndex];
  // maybe a value provided
  if (nextItem && nextItem[0] !== '-') {
    output = nextItem;
    // remove the output from the args
    // so that the flags is not dirty
    args.splice(outputIndex, 1);
  } else {
    throw new Error('"--output" is required');
  }
}

if (args.includes('--verbose')) {
  verbose = true;
}
// #endregion

// #region global instance
/* Program */
const program = {
  dirname: __dirname,
  filename: __filename,
  nodeBin: process.argv[0],
  flags: args.filter((arg) => arg[0] === '-'),
  files: args.filter((arg) => arg[0] !== '-' && arg[1] !== '-'),
};
// #endregion

// #region Execution

/* print the version */
if (program.flags.includes('--version') && program.flags.length === 1) {
  const pkg = require('./path-to-package.json');
  console.log(pkg.name, pkg.version);
  console.log('Node', process.versions.node);
  if (process.versions.electron) {
    console.log('Electron', process.versions.electron);
  }
  return;
}

if (program.flags.includes('--help')) {
  const bin = 'myCli';
  console.log(`
  Usage: ${bin} [option] [ FILE... | - ]

  Options:
    -h, --help                        show help information.
    -v, --version                     show ${bin} version.


    --verbose                         print verbose messages.
    -i, --input [ FILE... | - ]       input files
    -o, --output [ FILE ]             output destination

  Examples:

  $ ${bin} -i input.js -o script.output.js
                                      handle \`input.js\` and output as \`output.js\`.

  $ ${bin} -o output.js input.js      handle \`input.js\` and output as \`output.js\`.
`);
  return;
}

/* main logic */
// do whatever you need
try {
  spawnSync(
    program.nodeBin,
    ['-r', path.resolve(__dirname, 'index.js')].concat(args),
    {
      stdio: 'inherit',
    }
  );
} catch (error) {
  console.error(error);
}
// #endregion

/*
 * Inspired by bytenode.
 * see https://github.com/bytenode/bytenode/blob/master/lib/cli.js
 */
