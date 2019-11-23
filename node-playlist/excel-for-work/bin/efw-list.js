#! /usr/bin/env node
const program = require('commander');
const { logger, resolveDB, lsDB } = require('../utils');

program.parse(process.argv);

function listFiles (list) {
    logger('Now we have the following files in database:\n');
    list.forEach((file, index) => {
        logger.success(`${index} ->   ${file}`);
    });
    logger('\n\n');
    return list;
}

async function main () {
    const files = await lsDB(resolveDB('.'));
    listFiles(files);
}

main();