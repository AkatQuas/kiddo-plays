#!/usr/bin/env node
const program = require('commander');
const package = require('../package.json');

program
    .version(package.version, '-v, --version')
    .usage('<command> [project name]')
    .command('create', 'create a project')
    .parse(process.argv);