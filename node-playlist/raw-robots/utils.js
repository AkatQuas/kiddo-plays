const child_process = require('child_process'), path = require('path')

const resolve = dir => path.resolve(__dirname, dir)

const exec = cmd => child_process.execSync(cmd)

const execR = cmd => child_process.execSync(cmd).toString().trim()


module.exports = {
    resolve,
    exec,
    execR
}