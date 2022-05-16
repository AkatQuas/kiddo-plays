// @ts-check
const path = require('path');

const isDev = process.env.NODE_ENV === 'development';

/**@type {import('webpack').Configuration} */
const baseConfig = {
  mode: isDev ? 'development' : 'production',
  output: {
    path: path.resolve(__dirname, 'build'),
    filename: '[name].js',
  },
  plugins: [],
  module: {
    rules: [
      {
        test: /\.ts$/,
        loader: 'esbuild-loader',
        exclude: /node_modules/,
        options: {
          loader: 'ts',
          target: 'es2015',
        },
      },
    ],
  },
  resolve: {
    modules: ['node_modules'],
    extensions: ['', '.js', '.ts', '.json'],
  },
};

module.exports.isDev = isDev;
module.exports.baseConfig = baseConfig;
module.exports.resolveSrc = (/** @type {string[]} */ ...segments) =>
  path.resolve(__dirname, 'src', ...segments);
