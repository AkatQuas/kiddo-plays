const chalk = require('chalk');
const ora = require('ora');
const download = require('download-git-repo');
const path = require('path');
const Handlebars = require('handlebars');
const consolidate = require('consolidate');
const Metalsmith = require('metalsmith');
const rm = require('rimraf').sync;
const spawn = require('child_process').spawn;

const noneImg = name => !(/\.(jpe?g|png|svg|ico)/.test(name))

const logger = {
    error: msg => console.log(chalk.bold.red(msg)),
    success: msg => console.log(chalk.green(msg)),
    normal: msg => console.log(msg)
}

module.exports = {
    logger,
    download: target => {
        target = path.join(target || '.', '.download-tmp');
        return new Promise((resolve, reject) => {
            const url = 'gitprotocol:host:namespace:gitrepo#branch'
            const spinner = ora(`downloading templates: ${url}`)
            spinner.start();
            download(url, target, { clone: true }, err => {
                if  (err) {
                    spinner.fail();
                    return reject(err);
                } else {
                    spinner.succeed();
                    return resolve(target);
                }
            })
        })
    },
    generator: ({ metadata = {}, downloadTemp: src, root: dest = '.' }) => {
        return src ? (new Promise((resolve, reject) => {
            Metalsmith(process.cwd())
                .metadata(metadata)
                .clean(false)
                .source(src)
                .destination(dest)
                .use((files, metalsmith, done) => {
                    const meta = metalsmith.metadata()
                    Object.keys(files)
                        .filter(noneImg)
                        .forEach(fileName => {
                            const t = files[fileName].contents.toString();
                            files[fileName].contents = new Buffer(Handlebars.compile(t)(meta));
                        })
                    done();
                }).build(err => {
                    rm(src);
                    err ? reject(err) : resolve()
                })
        })) : (Promise.reject(`invalid source: ${src}`))
    },
    consolidate: ({ metadata = {}, downloadTemp: src, root: dest = '.' }) => {
        return src ? (new Promise((resolve, reject) => {

        })) : (Promise.reject(`invalid source: ${src}`))
    },
    iDependencies: ({context, cmd}) => {
        const cwd = path.resolve(process.cwd(), context.root);
        const spinner = ora(`installing dependencies in ${cwd}`)
        spinner.start();
        const progress = spawn(cmd, ['install'], { cwd})
        progress.on('close', s => {
            if ( s !== 0) {
                spinner.fail();
                logger.error(`install process exit with status ${s}`);
            } else {
                spinner.succeed();
                const msg = `You are good to go.\n========\n\n    cd ${context.root}\n    npm run dev\n\n\n`
                logger.success(msg);
            }
        })
    }
}