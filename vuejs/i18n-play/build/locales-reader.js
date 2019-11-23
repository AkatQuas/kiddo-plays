const fs = require('fs')
const fse = require('fs-extra')
const path = require('path')


const localesDir = path.resolve(__dirname, '../locales')
const output = path.resolve(__dirname,'../src', 'locales.message.json')

const list = fs.readdirSync(localesDir)

const messages = {}

list.forEach(ns => {
    const nsDir = path.resolve(localesDir, ns)
    const fields = fs.readdirSync(nsDir);

    messages[ns] = {};
    fields.forEach(file => {
        const name = file.split('.')[0];
        messages[ns][name] = fse.readJsonSync(path.resolve(nsDir, file))
    })
})

fse.outputJsonSync(output, messages);
console.log('locales messages generated, done')
