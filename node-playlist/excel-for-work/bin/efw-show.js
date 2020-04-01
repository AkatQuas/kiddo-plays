#! /usr/bin/env node
const program = require('commander');
const { logger, resolveDB, fs, calcTime, DBFilename } = require('../utils');
const Table = require('painting-table');

program.option('-y, --year <n>', 'Choose the year, default will be the current year', parseInt)
    .option('-q, --quarter <n>', 'Choose the quarter, default will be the current quarter', parseInt)
    .parse(process.argv);

function ensureExist () {
    const { year: cyear, quarter: cquarter } = calcTime();
    const filename = DBFilename({
        year: program.year || cyear,
        quarter: program.quarter || cquarter
    });
    return fs.pathExists(resolveDB(filename)).then(exist => {
        if (!exist) {
            logger.error(`No such quarter report ${filename} exist!\n Try another one.`);
            process.exit(0);
        }
        return resolveDB(filename);
    });
}

function readAndPrint (filename) {
    const content = fs.readJsonSync(filename);

    console.log(Table(content, {
        includes: ['time', 'type', 'content'],
        rename: {
            time: '时间',
            type: '类型',
            content: '工作内容'
        }
    }));

}

function main () {
    ensureExist().then(readAndPrint);
}

main();
