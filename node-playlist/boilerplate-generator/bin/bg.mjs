#!/usr/bin/env node

/*
 * This is only a simple template for CLI without any third-party libraries.
 *
 * Use at your own risk.
 */

'use strict';
import createEsmUtils from 'esm-utils';

const { filename, dirname, require: nodeRequire } = createEsmUtils(import.meta);

// #region argv parse
const args = process.argv.slice(2);

/* Flag: "help" */
expandFlag(args, '-h', '--help');

/* Flag: "version" */
expandFlag(args, '-v', '--version');

/* Option: "output", destination */
expandFlag(args, '-f', '--force');

/* Option: "output", destination */
expandFlag(args, '-o', '--output');

/* Option: "templates", custom templates folder */
expandFlag(args, '-t', '--templates');
// #endregion

// #region global variables
const payload = {
  templates: undefined,
  output: undefined,
  force: undefined,
  verbose: undefined,
};

expandPayload(payload, 'templates', args, '--templates');

expandPayload(payload, 'output', args, '--output');

expandPayload(payload, 'force', args, '--force', true);

expandPayload(payload, 'verbose', args, '--verbose', true);
// #endregion

// #region global instance
/* Program */
const program = {
  dirname: dirname,
  filename: filename,
  nodeBin: process.argv[0],
  flags: args.filter((arg) => arg[0] === '-' && arg[1] === '-'),
  params: args.filter((arg) => arg[0] !== '-' && arg[1] !== '-'),
};
// #endregion

// #region Execution

/* print the version */
if (program.flags.includes('--version') && program.flags.length === 1) {
  const pkg = nodeRequire('../package.json');
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

/* output help */
if (program.flags.includes('--help')) {
  const bin = 'bg';
  console.log(`
  Usage: ${bin} [option] [ TEMPLATE... | - ]

  Options:
    -h, --help                        show help information.
    -v, --version                     show ${bin} version.


    --verbose                         print verbose messages.
    -f, --force                       overwrite if destination is not empty.
    -t, --templates [ Folder ]        custom templates folder.
    -o, --output [ Folder ]           Required, output destination.

  Examples:

  $ ${bin} -o packages/new-app application
                                      create a boilerplate \`application\` in \`packages/new-app\`.

  $ ${bin} -o packages/new-sdk -t /path/to/templates sdk
                                      create a boilerplate \`sdk\` in \`packages/new-sdk\` using custom templates.
`);
  process.exit(0);
}

import { generate } from '../dist/index.mjs';
/* main logic */
// do whatever you need
try {
  checkPayload(payload, 'output');
  generate({
    output: payload.output,
    templates: payload.templates,
    force: payload.force,
    template: program.params[0],
  });
} catch (error) {
  console.error(error);
  process.exit(1);
}
// #endregion

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
