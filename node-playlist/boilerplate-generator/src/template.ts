import {
  checkbox,
  confirm,
  editor,
  input,
  password,
  select,
} from '@inquirer/prompts';
import Handlebars from 'handlebars';
import Metalsmith from 'metalsmith';
import { access, opendir } from 'node:fs/promises';
import { MetaFile } from '~/constant';
import { GenerateOptions, Meta } from '~/types';
import { isImage } from '~/utils';

export const hydrate = async (
  output: GenerateOptions['output'],
  meta: Meta,
  force = false
) => {
  if (
    (await dirExist(output)) &&
    (await dirEmpty(output)) === false &&
    force === false
  ) {
    throw new Error(
      'Output is not empty. Using "force" if you want to overwrite.'
    );
  }

  await _hydrate(output, meta);
};

async function _hydrate(output: string, meta: Meta) {
  const response = await collectInput(meta);

  Metalsmith(process.cwd()) // parent directory of this file
    .source(meta.dir) // source directory
    .destination(output) // destination directory
    .clean(true) // clean destination before
    .metadata(response)
    .use(async (files, mm, done) => {
      delete files[MetaFile];

      await Promise.all(
        Object.keys(files).map(async (fileName) => {
          if (await isImage(fileName, meta.dir)) {
            // simply copy image files
            return;
          }
          const file = files[fileName];
          const raw = file.contents.toString();
          const metadata = mm.metadata();

          file.contents = Buffer.from(Handlebars.compile(raw)(metadata));
        })
      );
      done(null, files, mm);
    })
    .build((err) => {
      // build process
      if (err) {
        throw err; // error handling is required
      }

      console.debug('\x1B[97;42;1m --- great --- \x1B[m');
    });
}

const prompts = {
  checkbox,
  confirm,
  editor,
  input,
  password,
  select,
} as const;

async function collectInput(meta: Meta): Promise<Record<string, unknown>> {
  const { inputs, metadata = {} } = meta;

  // static metadata
  const result = Object.assign({}, metadata);

  // dynamic metadata
  const keys = Object.keys(inputs);
  for (let index = 0; index < keys.length; index++) {
    const key = keys[index];
    const { _type = 'input', ...input } = inputs[key];
    if (_type in prompts) {
      // @ts-ignore complex union type
      const response = await prompts[_type](input);
      result[key] =
        // @ts-ignore complex unknown type
        typeof response['trim'] === 'function' ? response.trim() : response;
    }
  }

  return result;
}

async function dirExist(dir: string): Promise<boolean> {
  try {
    await access(dir);
    return true;
  } catch (_) {
    return false;
  }
}

async function dirEmpty(dir: string): Promise<boolean> {
  try {
    const fd = await opendir(dir);
    const dirent = await fd.read();
    await fd.close();

    return dirent === null;
  } catch (_) {
    return false;
  }
}
