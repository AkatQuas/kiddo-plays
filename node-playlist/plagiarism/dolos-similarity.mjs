import { Dolos } from '@dodona/dolos-lib';
import createEsmUtils from 'esm-utils';
import path from 'node:path';

const {
  dirname,
  filename,
  require,
  importModule,
  resolve,
  readJson,
  readJsonSync,
} = createEsmUtils(import.meta);

const dolos = new Dolos();
const report = await dolos.analyzePaths(
  ['./ts/add.ts', './ts/add2.ts'].map((f) => path.resolve(dirname, f))
);
console.debug(
  '\x1B[97;100;1m --- metadata (options) --- \x1B[m',
  '\n',
  report.metadata()
);
console.debug(
  '\x1B[97;100;1m --- pairs (similarity by file pairs) --- \x1B[m',
  '\n',
  report.allPairs()
);
/*
console.debug(
  '\x1B[97;100;1m --- kgrams --- \x1B[m',
  '\n',
  report.sharedFingerprints()
);

console.debug(
  '\x1B[97;100;1m --- Tokenized files --- \x1B[m',
  '\n',
  report.files
);

 */
