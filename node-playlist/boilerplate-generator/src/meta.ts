import { select } from '@inquirer/prompts';
import createEsmUtils from 'esm-utils';
import fg from 'fast-glob';
import path from 'node:path';
import { MetaFile } from '~/constant';
import { IMeta, Meta } from '~/types';
import { ensureAbsolutePath } from '~/utils';

const { require: nodeRequire } = createEsmUtils(import.meta);

export const collectMeta = async (templates = './templates') => {
  const templatesDir = ensureAbsolutePath(templates);
  const files = await fg([`**/${MetaFile}`], {
    absolute: true,
    cwd: templatesDir,
  });
  return Promise.all<Meta>(
    files.map(async (file) => {
      const m = nodeRequire(file);
      const x = typeof m === 'function' ? m() : m;
      fullfil(x, file);
      return x;
    })
  );
};

export const chooseMeta = async (template = '', meta: Meta[] = []) => {
  const match = meta.find((a) => a.name === template);
  if (match) {
    return match;
  }

  const t = await select<string>({
    message: 'Choose the template you want',
    choices: meta.map((a) => ({ name: a.name, value: a.name })),
  });
  return meta.find((a) => a.name === t) as Meta;
};

function fullfil(meta: IMeta, file: string): Meta {
  const dir = path.dirname(file);
  let m = meta as Meta;
  if (!m.name) {
    m.name = path.basename(path.dirname(file));
  }
  m.dir = dir;
  return m as Meta;
}
