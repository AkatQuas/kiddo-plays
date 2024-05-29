#!/usr/bin/env node
if (process.argv.includes('--version')) {
  const pkg = require('../package.json');
  console.debug('\x1B[97;42;1m --- version --- \x1B[m', '\n', pkg['version']);
  return;
}

require('../out/index.js');
