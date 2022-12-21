import fg from 'fast-glob';
import * as fse from 'fs-extra';
import * as path from 'node:path';
import * as yazl from 'yazl';

async function _createStream(
  folder: string,
  pattern: fg.Pattern | fg.Pattern[],
  options: fg.Options = {}
) {
  const entries = await fg(pattern, Object.assign(options, { cwd: folder }));
  const zipFile = new yazl.ZipFile();
  entries.forEach((entry) => {
    // filename matters !!
    // entry is relative to folder
    // when add to zip, use absolute path
    zipFile.addFile(path.resolve(folder, entry), entry);
  });
  zipFile.end();
  return zipFile.outputStream;
}

export async function createZipStream(
  folder: string,
  pattern: fg.Pattern | fg.Pattern[],
  options: fg.Options = {}
): Promise<NodeJS.ReadableStream> {
  return await _createStream(folder, pattern, options);
}

export async function createZipFile(
  folder: string,
  output: string,
  pattern: fg.Pattern | fg.Pattern[],
  options?: fg.Options
): Promise<void> {
  const stream = await _createStream(folder, pattern, options);
  return await new Promise((resolve, reject) => {
    stream
      .pipe(fse.createWriteStream(output))
      .on('close', resolve)
      .on('error', reject);
  });
}
