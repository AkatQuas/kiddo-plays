// @ts-check
const { execSync } = require('child_process');
const CopyPlugin = require('copy-webpack-plugin');
const { merge } = require('webpack-merge');

const { isDev, baseConfig } = require('./webpack.config.base');

const mainConfig = merge(baseConfig, {
  target: 'electron-main',
  devtool: isDev ? 'inline-source-map' : false,
  entry: {
    index: './src/app/index.ts',
  },
  watch: isDev,
  resolve: {},
  plugins: [
    new CopyPlugin({
      patterns: [
        {
          from: 'src/assets',
          to: 'assets',
        },
      ],
    }),
  ],
});

if (process.env.START_ELECTRON === '1') {
  mainConfig.plugins.push({
    apply: (compiler) => {
      compiler.hooks.afterEmit.tap('AfterEmitPlugin', () => {
        try {
          execSync('overmind restart electron');
        } catch (e) {}
      });
    },
  });
}

module.exports = mainConfig;
