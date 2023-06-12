import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { ensureAbsolutePath, isImage } from '~/utils';

describe('utils', () => {
  describe('ensureAbsolutePath', () => {
    it('/Users/fun is absolute', () => {
      expect(ensureAbsolutePath('/Users/fun')).toEqual('/Users/fun');
    });
    it('./fun is absolute', () => {
      expect(ensureAbsolutePath('./fun')).toEqual(
        path.resolve(process.cwd(), './fun')
      );
    });
  });

  describe('isImage', () => {
    it('package.json is not an image', async () => {
      const r = await isImage('package.json', process.cwd());
      expect(r).toEqual(false);
    });
    it('package.png does not exist', async () => {
      const r = await isImage('package.png', process.cwd());
      expect(r).toEqual(false);
    });
    it('templates/sdk/fun.png is an image', async () => {
      const r = await isImage('templates/sdk/fun.png', process.cwd());
      expect(r).toEqual(true);
    });
  });
});
