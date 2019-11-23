const path = require('path')

exports.nunjucks = {
    enable: true,
    package: 'egg-view-nunjucks'
}

exports.ua = {
    enable: true,
    path : path.resolve(__dirname, '../lib/plugin/egg-ua')
}

exports.validate = {
    enable: true,
    package: 'egg-validate'
}