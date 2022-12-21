import archiver from 'archiver';
import { createWriteStream, readFile } from 'fs-extra';
import crypto from 'node:crypto';
import * as path from 'node:path';
import { Transform } from 'node:stream';
/**
 *
 * @param source target directory
 */
export async function zipStream(source: string): Promise<archiver.Archiver> {
  const archive = archiver('zip', {
    statConcurrency: 4,
    // more buffer when compress
    highWaterMark: 32 * 1024 * 1024,
  });

  archive
    .on('warning', function (err) {
      if (err.code === 'ENOENT') {
        // log warning
        console.warn(err);
      } else {
        throw new Error(`${err.message}`);
      }
    })
    .on('error', (err) => {
      throw new Error(`${err.message}`);
    })
    .glob(
      '**/*',
      {
        cwd: source,
        ignore: ['.*/**/*', 'node_modules/**/*'],
      },
      {}
    );
  await archive.finalize();
  return archive;
}

async function getMD5(zipStream: archiver.Archiver) {
  const hash = crypto.createHash('md5');
  type MD5Stream = Transform & { __md5: string };
  const md5Stream = new Transform({
    // uncomment the option if more buffer is need
    // highWaterMark: 32 * 1024 * 1024,
    transform(this: Transform, chunk, encoding: BufferEncoding, callback) {
      hash.update(chunk);
      callback(null, chunk);
    },
  }) as MD5Stream;
  md5Stream.__md5 = '';
  zipStream.pipe(md5Stream);
  return new Promise<MD5Stream>((resolve, reject) => {
    zipStream.on('end', () => {
      md5Stream.__md5 = hash.digest('hex');
      resolve(md5Stream);
    });
  });
}

async function getMD5File(filePath: string) {
  const hash = crypto.createHash('md5');
  const content = await readFile(filePath);
  hash.update(content);
  return hash.digest('hex');
}

async function main() {
  const s = await zipStream(path.resolve(__dirname, 'demo'));
  const n = await getMD5(s);
  console.log(
    `%c***** after await this *****`,
    'background: #3C89FF; color: #f8f8f8; padding: 10px;margin-bottom: 5px;',
    '\n',
    { r: s.readableLength, w: s.writableLength },
    { nr: n.readableLength, nw: n.writableLength, md5: n.__md5 },
    '\n'
  );
  const target = path.resolve(__dirname, 'ignore-this.zip');
  n.pipe(createWriteStream(target));
  n.on('close', async () => {
    console.log(
      `%c***** after zip *****`,
      'background: #3C89FF; color: #f8f8f8; padding: 10px;margin-bottom: 5px;',
      '\n',
      {
        md5: await getMD5File(target),
      },
      '\n'
    );
  });
}
main();

setTimeout(async () => {
  process.exit(0);
}, 5000);
