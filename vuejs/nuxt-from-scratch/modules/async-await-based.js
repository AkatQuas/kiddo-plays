const fse = require('fs-extra')

module.exports = async function asyncModule() {
    const pkg = await fse.readJson('../package.json')
}