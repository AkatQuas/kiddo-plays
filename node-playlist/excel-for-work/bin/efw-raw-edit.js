#! /usr/bin/env node
const program = require('commander');
const inquirer = require('inquirer');
const { resolveDB, lsDB } = require('../utils');
const spawn = require('child_process').spawn;

program.parse(process.argv);

async function main () {
    const files = await lsDB(resolveDB('.'));
    const { file } = await inquirer.prompt([
        {
            name: 'file',
            message: 'Choose the data you need to export',
            type: 'list',
            choices: files
        }
    ]);

    const child = spawn('vim', [resolveDB(file)], { stdio: 'inherit' });

    child.on('exit', function (e, code) {
        console.log('finished');
    });
}

main();