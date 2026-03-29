/// <reference path="../node_modules/.pnpm/zx@4.3.0/node_modules/zx/globals.d.ts" />
import Jimp from 'jimp';
import fetch from 'node-fetch';
import os from 'node:os';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);

export async function wallpaper() {
  const { filename, url } = await today();
  const filepath = resolve(os.tmpdir(), encodeURIComponent(filename));
  await download(url, filepath);
  return filepath;
}

async function today() {
  const response = await fetch('https://bing.biturl.top/');
  /** @type {Record<'start_date' | 'end_date' | 'url' | 'copyright' | 'copyright_link', string>} */
  const data = await response.json();
  const { url, copyright } = data;
  return { filename: copyright, url };
}

/**
 *
 * @param {string} url
 * @param {string} filepath
 */
async function download(url, filepath) {
  const [wp, blank] = await Promise.all([
    Jimp.read(url),
    new Promise((resolve, reject) => {
      new Jimp(10, 10, '#FFFFFF00', (err, image) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(image);
      });
    })
  ]);

  return blank
    .resize(Math.floor(wp.getWidth() / 100) * 100, Jimp.AUTO)
    .composite(
      wp,
      (blank.getWidth() - wp.getWidth()) / 2,
      (blank.getHeight() - wp.getHeight()) / 2
    )
    .writeAsync(filepath);
}

if (process.argv[1] === __filename) {
  wallpaper().then((filepath) => {
    console.log('Wallpaper saved to:', filepath);
  });
}
