const rules = require('./webpack.rules');
const plugins = require('./webpack.plugins');

/**
 * @type {import('webpack').Configuration}
 */
module.exports = {
  module: {
    rules: rules.concat({
      test: /\.css$/,
      use: [{ loader: 'style-loader' }, { loader: 'css-loader' }],
    }),
  },
  plugins: plugins,
  resolve: {
    extensions: ['.js', '.ts', '.jsx', '.tsx', '.css'],
    fallback: {
      fs: false,
      path: false,
    },
  },
};
