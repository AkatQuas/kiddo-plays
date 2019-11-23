#! /usr/bin/env node
const program = require('commander');
const inquirer = require('inquirer');
const Excel = require('exceljs');
const resolve = require('path').resolve;
const { logger, resolveDB, fs, lsDB } = require('../utils');

program.parse(process.argv);

const makeExcelname = file => {
    const res = /^(\d*)-q(\d).*$/.exec(file);
    const [, year, quarter] = res;
    const filename = `${year}第${quarter}季度工作小结.xlsx`;
    const dir = process.cwd();
    return resolve(dir, filename);
};

function chooseQuarter (list) {
    return inquirer.prompt([
        {
            name: 'file',
            message: 'Choose the data you need to export',
            type: 'list',
            choices: list
        }
    ]);
}

function makeExport (file) {
    const filepath = resolveDB(file);
    logger.warning(`Exporting data to Excel from file: ${filepath}`);
    const excelname = makeExcelname(file);
    const data = fs.readJsonSync(filepath);

    const WORKBOOK = new Excel.Workbook();
    const SHEET = WORKBOOK.addWorksheet(file);
    SHEET.columns = [
        { header: '时间', key: 'time', width: 20 },
        { header: '类别', key: 'type', width: 20 },
        { header: '工作内容', key: 'content', width: 40 },
        { header: '备注', key: 'note', width: 50 }
    ];
    SHEET.addRows(data);

    return WORKBOOK.xlsx.writeFile(excelname).then(_ => {
        logger.success('The Excel file has been saved successfully');
    }).catch(err => logger.error(err));
}

async function main () {
    const files = await lsDB(resolveDB('.'));
    const { file } = await chooseQuarter(files);
    makeExport(file);
}

main();
