// @ts-check
const HtmlWebpackPlugin = require('html-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const { merge } = require('webpack-merge');
const { isDev, baseConfig, resolveSrc } = require('./webpack.config.base');

const PORT = process.env.PORT || 4200;

const rendererConfig = merge(baseConfig, {
  target: 'electron-renderer',
  devtool: isDev ? 'eval-source-map' : false,
  entry: {
    renderer: './src/renderer/index.ts',
  },
  module: {
    rules: [
      {
        test: /\.css$/i,
        use: ['style-loader', 'css-loader'],
      },
      {
        test: /\.less$/i,
        use: [
          isDev ? 'style-loader' : MiniCssExtractPlugin.loader,
          {
            loader: 'css-loader',
            options: {
              sourceMap: false,
            },
          },
          {
            loader: 'less-loader',
            options: {
              sourceMap: false,
            },
          },
        ],
      },
    ],
  },
  node: {
    __dirname: false,
    __filename: false,
  },
  devServer: {
    static: {
      directory: baseConfig.output.path,
    },
    port: PORT,
    hot: true,
  },
  plugins: [
    new HtmlWebpackPlugin({
      title: 'Material Palette',
      template: resolveSrc('renderer', 'index.html'),
      filename: 'renderer.html',
    }),
    isDev ? null : new MiniCssExtractPlugin(),
  ].filter(Boolean),
});

module.exports = rendererConfig;
