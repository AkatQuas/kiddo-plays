#!/usr/bin/env node
const program = require('commander');
const path = require('path');
const fs = require('fs');
const inquirer = require('inquirer');
// const glob = require('glob');
const { logger, download, generator, iDependencies } = require('./utils');

program
    .usage('<project-name>')
    .option('-d, --directory', 'the project\'s parent directory')
    .parse(process.argv)

const projectName = program.args[0];

let next = void 0;

if (!projectName) {
    return program.help();
}

const CWD = process.cwd();

let rootName = path.basename(CWD);
const list = fs.readdirSync(CWD)
    .filter(name => name.includes(projectName))
    .filter(name => fs.statSync(path.resolve(CWD, name)).isDirectory());

if (list.length) {
    return logger.error(`the directory ${projectName} exists`);
} else if (rootName === projectName) {
    next = inquirer.prompt([
        {
            name: 'buildInCurrent',
            message: 'current directory is empty, and its name is same as the target project\'s name, overwrite here?',
            type: 'confirm',
            default: false
        }
    ]).then(({ buidInCurrent }) => Promise.resolve(buidInCurrent ? '.' : projectName));
} else {
    next = Promise.resolve(projectName);
}

const main = _ => {
    next.then(projectRoot => {
        if (projectRoot !== '.') {
            fs.mkdirSync(projectRoot);
        }
        download(projectRoot).then(target => ({
            root: projectRoot,
            name: projectRoot,
            downloadTemp: target
        })).then(
            context => inquirer.prompt([
                {
                    name: 'author',
                    message: 'Author',
                    default: ''
                },
                {
                    name: 'projectName',
                    message: 'Name of project',
                    default: context.name
                },
                {
                    name: 'projectVersion',
                    message: 'Initial version',
                    default: '1.0.0'
                },
                {
                    name: 'projectDescription',
                    message: 'Project description',
                    default: `A project named ${context.name}`
                },
                {
                    name: 'themeDescription',
                    message: 'JS主题名称，用中文',
                    validate: n => !!n
                },
                {
                    name: 'useRouter',
                    message: 'Using react-router',
                    default: false
                },
                {
                    name: 'gitUrl',
                    message: 'git repository url',
                    default: ''
                }
            ]).then(ans => ({
                ...context,
                metadata: { ...ans }
            })).catch(err => Promise.reject(err))
        ).then(context => {

            generator(context).then(_ => {
                inquirer.prompt([
                    {
                        type: 'list',
                        name: 'run',
                        message: 'install Dependencies?',
                        choices: [
                            'run npm install',
                            'run yarn install',
                            'no, I will handle myself'
                        ]
                    }
                ]).then(({ run }) => {
                    const match = /run (\w+)/.exec(run);
                    return match ? iDependencies({
                        context,
                        cmd: match[1]
                    }) : false
                });
            });
        }).catch(err => logger.error(err));
    })
}

next && main();