import { readFile } from 'fs/promises';
import * as pako from 'pako';

import * as Base64 from 'js-base64';

async function main() {
  const dataFile = './data.json';
  // const dataFile = './data-tiny.json';
  // const dataFile = './data-large.json';
  const DATA = JSON.parse(await readFile(new URL(dataFile, import.meta.url)));

  const compressedUint8 = pako.deflate(JSON.stringify(DATA));
  const result = Base64.fromUint8Array(compressedUint8);

  console.log(result.length, result);
  console.log(JSON.stringify(DATA).length);

  const a = new URL('index.html', 'http://localhost:8090');
  a.searchParams.set('name', result);
  console.log(a.toString());
  // const new1 = Base64.toUint8Array(date);
  // const new2 = pako.inflate(new1, { to: 'string' });
}
main();
