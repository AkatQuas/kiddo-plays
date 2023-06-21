import { Dolos } from '@dodona/dolos-lib';
import createEsmUtils from 'esm-utils';

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
const report = await dolos.analyzePaths(['./simple-dataset/info.csv']);
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
