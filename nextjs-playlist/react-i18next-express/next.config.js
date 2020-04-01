const path = require('path')
const fs = require('fs')

function moduleDir (m) {
  return path.dirname(require.resolve(`${m}/package.json`))
}

module.exports = {
  webpack: (config, { dev }) => {
    config.resolve.extensions = ['.web.js', '.js', '.jsx', '.json'];
    config.resolve.alias = {
      ...config.resolve.alias,
      'components': path.resolve(__dirname, 'components'),
      'containers': path.resolve(__dirname, 'containers')
    }

   
    return config
  }
}
