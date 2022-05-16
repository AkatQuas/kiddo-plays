const log = require('electron-log');
const imagemin = require('imagemin');
const imageminMozjpeg = require('imagemin-mozjpeg');
const imageminPngquant = require('imagemin-pngquant');
const path = require('path');
const os = require('os');

module.exports.compressImage = compressImage;
module.exports.getOutputFolder = getOutputFolder;

let _output = '';
function getOutputFolder() {
  if (!_output) {
    _output = path.resolve(os.homedir(), 'image-shrink');
  }

  return _output;
}

/**
 * @param {{image: string; quality: string}} options
 */
async function compressImage(options) {
  try {
    const pngQuality = parseInt(options.quality) / 100;
    const files = await imagemin([options.image], {
      destination: getOutputFolder(),
      plugins: [
        imageminMozjpeg({ quality: parseInt(options.quality) }),
        imageminPngquant({
          quality: [pngQuality, pngQuality],
        }),
      ],
    });
    const output = files[0].destinationPath;
    log.info(`Compress success: from ${options.image} to ${output}.`);
    return {
      output,
      message: null,
    };
  } catch (error) {
    log.error(`Compress failed: ${error.message}`);
    return {
      output: null,
      message: error.message,
    };
  }
}
