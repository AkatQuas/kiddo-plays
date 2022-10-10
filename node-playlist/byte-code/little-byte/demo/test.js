const { walker } = require('../lib/index').default;
const path = require('path');

async function mainTest() {
  await testBuild();
  testRun();
}

mainTest();

/* --- */

function testBuild() {
  // build
  return walker.start({
    inputDir: path.join(__dirname, './src'),
    outputDir: path.join(__dirname, './dist'),
    onFile(fileInfo) {
      if (fileInfo.relativePath.startsWith('foobar/')) {
        return 'ignore';
      }

      if (fileInfo.name === 'my-dog.txt') {
        return 'ignore';
      }

      if (fileInfo.isScript) {
        return 'compile';
      } else {
        // copy none-js files to dist folder
        return 'copy';
      }
    },
  });
}

function testRun() {
  require('./dist/index');
}
