#!/usr/bin/env node
'use strict';

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname);
const bytenode = path.join(root, 'node_modules', '.bin', 'bytenode');
const indexJs = path.join(root, 'example', 'index.js');

execSync(`"${bytenode}" --compile "${indexJs}"`, { stdio: 'inherit', cwd: root });

fs.writeFileSync(indexJs, "require('bytenode');require('./index.jsc')");
console.log('Obfuscation complete');
