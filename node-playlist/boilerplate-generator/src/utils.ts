import { fileTypeFromBuffer } from 'file-type';

import path from 'node:path';
import { readChunk } from 'read-chunk';

export const ensureAbsolutePath = (p: string) => {
  if (path.isAbsolute(p)) {
    return p;
  }

  return path.resolve(process.cwd(), p);
};

export const isImage = async (filePath: string, templatesDir: string) => {
  try {
    const buffer = await readChunk(path.resolve(templatesDir, filePath), {
      length: 4100,
    });

    const type = await fileTypeFromBuffer(buffer);
    return type ? type.mime.startsWith('image/') : false;
  } catch (error) {
    if (error) {
      console.debug('\x1B[97;101;1m --- mime error --- \x1B[m', '\n', {
        filePath,
        error,
      });
    }
    return false;
  }
};
