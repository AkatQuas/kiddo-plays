#! /usr/bin/env node

const program = require('commander');
const pkg = require('../package.json');

program
    .version(pkg.version, '-v, --version')
    .command('add', 'add a working item to the database[json files]')
    .command('list', 'list the database you have created')
    .command('show', 'print a quarter report')
    .command('export', 'export to excel with data from database')
    .command('raw-edit', 'a private command to edit database');

program.parse(process.argv);