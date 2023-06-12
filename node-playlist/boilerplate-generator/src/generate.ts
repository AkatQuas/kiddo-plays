import { chooseMeta, collectMeta } from '~/meta';
import { hydrate } from '~/template';
import { GenerateOptions } from '~/types';
import { ensureAbsolutePath } from '~/utils';

export const generate = async ({
  output,
  template,
  templates,
  force,
}: GenerateOptions) => {
  // collect templates meta
  const meta = await collectMeta(templates);

  // choose boilerplate
  const boilerplate = await chooseMeta(template, meta);

  // hydrate
  await hydrate(ensureAbsolutePath(output), boilerplate, force);
};
