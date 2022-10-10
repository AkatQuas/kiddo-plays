import * as fs from 'fs';
import * as _module from 'node:module';
import * as path from 'path';
import * as v8 from 'v8';
import * as vm from 'vm';

v8.setFlagsFromString('--no-lazy');

/**
 * Compile {@link filePath} to {@link outputDir}.
 * If outputDir not given, would generate file in the same directory as the filePath.
 *
 * @param filePath full path for source file
 * @param outputDir output directory
 */
export async function compileFile(filePath: string, outputDir = '') {
  outputDir = outputDir || path.dirname(filePath);
  // full path for output without extension
  const prefix = path.join(
    outputDir,
    path.basename(filePath, path.extname(filePath))
  );

  const code = await fs.promises.readFile(filePath, 'utf-8');
  /*
    Built-in wrap function,
    see document, https://nodejs.org/api/modules.html#the-module-wrapper
    see implementation, https://github.com/nodejs/node/blob/170b4849b0c053baeddea44f6c5de08912f13fa4/lib/internal/modules/cjs/loader.js#L215-L248
  */
  const wrappedCode = _module.wrap(code);

  const script = new vm.Script(wrappedCode, {
    filename: filePath,
  });

  // create bytecode from script
  const bytecode = script.createCachedData();
  await fs.promises.writeFile(prefix + '.bytecode', bytecode);

  // rewrite source file
  // remove everything except `wrap` function.
  const sourceMap = _module.wrap(' '.repeat(code.length));
  await fs.promises.writeFile(prefix + '.bytesource', sourceMap, 'utf-8');
}
