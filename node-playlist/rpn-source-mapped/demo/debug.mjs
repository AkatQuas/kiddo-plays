#! /usr/bin/env node
import fs from 'fs';
import path from 'path';
import * as url from 'url';
import * as rpn from '../lib/rpn.mjs';

const __filename = url.fileURLToPath(import.meta.url);
const __dirname = url.fileURLToPath(new URL('.', import.meta.url));

const files = [path.resolve(__dirname, './example-simple.rpn')];

files.forEach((file) => {
  const input = fs.readFileSync(file);
  const codeFilename = file.replace(/\.[\w]+$/, '.js');
  const mapFilename = codeFilename + '.map';

  const rootSourceNode = rpn.compile(input, {
    originalFilename: file,
  });
  const output = rootSourceNode.toStringWithSourceMap({
    file: mapFilename,
  });
  fs.writeFileSync(
    file.replace(/\.[\w]+$/, '.js'),
    output.code + '\n//# sourceMappingURL=' + mapFilename
  );
  fs.writeFileSync(mapFilename, JSON.stringify(output.map, null, 2));
});
