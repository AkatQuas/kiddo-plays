#! /usr/bin/env node
import fs from 'fs';
import * as rpn from '../lib/rpn.mjs';

process.argv.slice(2).forEach((file) => {
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
