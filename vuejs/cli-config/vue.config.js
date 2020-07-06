const path = require('path')

const isProd = process.env.NODE_ENV === 'production'
/**
 * The complete guidance
 * https://cli.vuejs.org/config/#vue-config-js
 */
module.exports = {
  publicPath: isProd ? '/' : '/',

  outputDir: path.resolve(__dirname, 'dist'),

  assetsDir: 'static',

  filenameHashing: isProd,

  // https://cli.vuejs.org/config/#lintonsave
  lintOnSave: 'warning',

  productionSourceMap: true,

  configureWebpack: (config) => {
    console.log(Object.keys(config))

    // no need to return the config
    // modify the config directly
  },

  chainWebpack: (config) => {
    // no need to return the config
    // modify the config directly
  },

  devServer: {
    port: 4200,
    proxy: {
      '^/api': {
        target: '<url>',
        ws: true,
        changeOrigin: true,
      },
      '^/foo': {
        target: '<other_url>',
      },
    },
  },

  parallel: require('os').cpus().length - 1,

}
