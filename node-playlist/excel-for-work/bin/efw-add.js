#! /usr/bin/env node
const program = require('commander');
const inquirer = require('inquirer');
const { logger, calcTime, resolveDB, fs, DBFilename } = require('../utils');

program.option('-y, --year <n>', 'Choose the year, default will be the current year', parseInt)
    .option('-q, --quarter <n>', 'Choose the quarter, default will be the current quarter', parseInt).parse(process.argv);

async function checkQuarter () {
    const { year: cyear, quarter: cquarter, today } = calcTime();
    const timeState = {
        year: program.year || cyear,
        quarter: program.quarter || cquarter,
        today
    };
    const { rightQuarter } = await inquirer.prompt([
        {
            name: 'rightQuarter',
            message: `We are going to add an item for Year ${timeState.year} Quarter ${timeState.quarter}, it's fine?`,
            type: 'confirm',
            default: true
        }
    ]);
    if (!rightQuarter) {
        logger.warning('It seems we need to choose another year or quarter.');
        process.exit(0);
    }
    return timeState;
}

function collectInfo () {
    return inquirer.prompt([
        {
            name: 'type',
            type: 'list',
            message: 'Choose the work type',
            choices: [
                '营销', '项目', '迭代', '拉新', '其他', 'demo'
            ],
            default: '营销'
        },
        {
            name: 'content',
            type: 'input',
            message: 'Tell me what work you did',
            validate: ans => !!ans
        },
        {
            name: 'note',
            type: 'input',
            message: 'Do you want add any note to that?',
            default: 'N/A'
        }
    ]);
}

function save2json ({ timeState, type, content, note }) {
    const filename = DBFilename(timeState);
    const { today } = timeState;
    const file = resolveDB(filename);
    fs.ensureFileSync(file);
    let oldContent;
    try {
        oldContent = fs.readJsonSync(file);
    } catch (error) {
        oldContent = [];
    }
    oldContent.push({
        time: today,
        type, content, note
    });
    return fs.writeJson(file, oldContent, { spaces: 4 }).then(_ => {
        logger.success('Add a work item successfully');
    });
}

async function main () {
    const timeState = await checkQuarter();
    const infos = await collectInfo();
    save2json({
        timeState,
        ...infos
    });
}

main();