#!/usr/bin/env node

// @ts-check

/*
 * This is only a simple template for CLI without any third-party libraries.
 *
 * Use at your own risk.
 */

'use strict';

import createEsmUtils from 'esm-utils';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

const { dirname, filename, require, importModule, readJson, readJsonSync } =
  createEsmUtils(import.meta);

// #region argv parse
const args = process.argv.slice(2);

/* the flag `help` */
expandFlag(args, '-h', '--help');

/* the flag `version` */
expandFlag(args, '-v', '--version');

// more argv flag to parse

/* for example, a flag `output` */
expandFlag(args, '-o', '--output');

/* for example, a flag `input` */
expandFlag(args, '-i', '--input');
// #endregion

// #region global variables
const payload = {
  input: '',
  output: '',
  verbose: false,
};

expandPayload(payload, 'input', args, '--input');
expandPayload(payload, 'output', args, '--output');
expandPayload(payload, 'verbose', args, '--verbose', true);
// #endregion

// #region global instance
/* Program */
const program = {
  dirname,
  filename,
  nodeBin: process.argv[0],
  flags: args.filter((arg) => arg[0] === '-'),
  params: args.filter((arg) => arg[0] !== '-' && arg[1] !== '-'),
};
// #endregion

// #region Execution

/* print the version */
if (program.flags.includes('--version') && program.flags.length === 1) {
  const pkg = readJsonSync('../package.json');
  const info = {
    name: pkg.name,
    version: pkg.version,
    Node: process.versions.node,
  };
  if (process.versions.electron) {
    info.Electron = process.versions.electron;
  }
  console.table(info);
  process.exit(0);
}

if (program.flags.includes('--help')) {
  /* use your cli name */
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
  process.exit(0);
}

/* main logic */
// do whatever you need
try {
  checkPayload(payload, 'output');
  spawnSync(
    program.nodeBin,
    ['-r', path.resolve(__dirname, 'index.js')].concat(args),
    {
      stdio: 'inherit',
    }
  );
} catch (error) {
  console.error(error);
  process.exit(1);
}
// #endregion

/*
 * Inspired by bytenode.
 * see https://github.com/bytenode/bytenode/blob/master/lib/cli.js
 */

/* --- inner --- */

/**
 * Update the flag, mutate {@link args} directly
 * @param {string[]} args
 * @param {string} abbr abbreviate flag
 * @param {string} full full flag
 */
function expandFlag(args, abbr, full) {
  if (args.includes(abbr)) {
    args[args.indexOf(abbr)] = full;
  }
}

/**
 * Mutate {@link payload} and {@link args} directory
 * @param {object} payload
 * @param {string} key
 * @param {string[]} args
 * @param {string} flag
 * @param {boolean} bool
 */
function expandPayload(payload, key, args, flag, bool = false) {
  const index = args.indexOf(flag);
  // flag not found
  if (index === -1) {
    return;
  }

  if (bool) {
    payload[key] = true;
    return;
  }

  const next = args[index + 1];
  if (next && next[0] !== '-') {
    payload[key] = next;
    args.splice(index + 1, 1);
  }
}

/**
 * Validate payload
 * @param {object} payload
 * @param {string} key
 */
function checkPayload(payload, key) {
  if (payload[key] === undefined) {
    throw new Error(`"--${key}" is required`);
  }
}
