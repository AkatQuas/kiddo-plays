const fs = require('fs-extra');
const { resolveRoot } = require('./utils');
const { execSync } = require('child_process');


const distDir = resolveRoot('dist');

fs.emptyDirSync(distDir);

execSync('parcel build src/*.html', {
  cwd: resolveRoot(),
});


