// @ts-check
/// <reference path="./node_modules/.pnpm/zx@4.3.0/node_modules/zx/globals.d.ts" />
import dayjs from 'dayjs';
import os from 'node:os';
import { basename, dirname, isAbsolute, resolve } from 'node:path';
import 'zx/globals';

/**
 * @typedef {('shot' | 'record' | 'phone_record')} ExtType
 * */

$.verbose = false;

async function main() {
  const /** @type {any} */ received = argv;
  validateArguments(received);
  const { dir, type } = argv;
  const output = getZipFile(type, resolve(os.homedir(), 'Desktop'));
  const password = genPassword();
  await doZip(dir, output, password);

  console.debug('\x1B[97;101;1m --- pw --- \x1B[m', '\n', {
    pw: password,
    output
  });
}

main();

/* --- helper --- */

/**
 * @param {{dir: string; type?: ExtType}} argv
 */
function validateArguments(argv) {
  const { dir, type } = argv;

  if (!dir) {
    helper();

    console.error('Arguments required "dir".');
    process.exit(1);
  }
  if (!isAbsolute(dir)) {
    console.error('"dir" should be absolute.');
    process.exit(1);
  }
}

/**
 *
 * @param {ExtType | undefined} type
 * @param {string} parent
 */
function getZipFile(type, parent) {
  let filename = '';
  switch (type) {
    case 'record':
      filename = RecordName();
      break;
    case 'shot':
      filename = ShotName();
      break;
    case 'phone_record':
      filename = PhoneRecordName();
      break;
    default:
      filename = Math.random() > 0.5 ? ShotName() : RecordName();
      break;
  }

  return resolve(parent, filename);
}
/**
 * Return a name like `Screen Recording 2022-07-07 at 09.42.14.mov`
 * @returns {string}
 */
function RecordName() {
  const now = dayjs();
  const date = now.format('YYYY-MM-DD');
  const hms = now.format('hh.mm.ss');
  return `Screen Recording ${date} at ${hms}.mov`;
}

/**
 * Return a name like `Screen Shot 2022-07-27 at 17.25.30.png`
 * @returns {string}
 */
function ShotName() {
  const now = dayjs();
  const date = now.format('YYYY-MM-DD');
  const hms = now.format('hh.mm.ss');
  return `Screen Shot ${date} at ${hms}.png`;
}

/**
 *
 * Return a name like `RPReplay_Final1662538044.MP4`
 * @returns {string}
 */
function PhoneRecordName() {
  const now = Math.floor(Date.now() / 1000);
  return `RPReplay_Final${now}.MP4`;
}

function genPassword() {
  const pws = [];
  for (let index = 0; index < 100; index++) {
    pws.push(Math.random().toString(36).slice(2, 10));
  }
  const candidates = [];
  for (let index = 0; index < 4; index++) {
    const idx = Math.floor(Math.random() * 100);
    candidates.push(pws[idx]);
  }
  return (
    candidates[0] +
    '#' +
    candidates[1] +
    '@' +
    candidates[2] +
    '%' +
    candidates[3]
  );
}
/**
 *
 * @param {string} dir target dir to compress
 * @param {string} filepath full path for output zip
 * @param {string} password
 */
async function doZip(dir, filepath, password) {
  cd(dirname(dir));
  const args = [
    '--password',
    password,
    '-r',
    '-9',
    filepath,
    basename(dir),
    '-x',
    '**/node_modules/*'
  ];
  await $`zip ${args}`;
}

function helper() {
  const examples = [
    { type: 'record', sample: 'Screen Recording 2022-07-07 at 09.42.14.mov' },
    { type: 'shot', sample: 'Screen Shot 2022-07-27 at 17.25.30.png' },
    { type: 'phone_record', sample: 'RPReplay_Final1662537195.MP4' }
  ];

  console.log('Supported types');
  console.table(examples);
  console.log('Choose Type wisely\n');
}
