const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const { ModuleFederationPlugin } = require('webpack').container;

module.exports = {
  mode: 'development',
  entry: './src/index.tsx',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: '[name].[contenthash].js',
    publicPath: 'auto',
    clean: true,
  },
  resolve: {
    extensions: ['.tsx', '.ts', '.jsx', '.js'],
    alias: {
      '@': path.resolve(__dirname, 'src'),
      // Module Federation type aliases - point to actual source files
      'products/ProductsList': path.resolve(__dirname, '../products/src/components/ProductsList.tsx'),
      'products/ProductCard': path.resolve(__dirname, '../products/src/components/ProductCard.tsx'),
      'products/ProductDetail': path.resolve(__dirname, '../products/src/components/ProductDetail.tsx'),
      'cart/CartWidget': path.resolve(__dirname, '../cart/src/components/CartWidget.tsx'),
      'cart/CartDrawer': path.resolve(__dirname, '../cart/src/components/CartDrawer.tsx'),
      'cart/Checkout': path.resolve(__dirname, '../cart/src/components/Checkout.tsx'),
      'user/UserMenu': path.resolve(__dirname, '../user/src/components/UserMenu.tsx'),
      'user/LoginForm': path.resolve(__dirname, '../user/src/components/LoginForm.tsx'),
      'user/RegisterForm': path.resolve(__dirname, '../user/src/components/RegisterForm.tsx'),
      'user/Profile': path.resolve(__dirname, '../user/src/components/Profile.tsx'),
    },
  },
  module: {
    rules: [
      {
        test: /\.(ts|tsx)$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: [
              '@babel/preset-typescript',
              ['@babel/preset-react', { runtime: 'automatic' }],
            ],
          },
        },
      },
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader', 'postcss-loader'],
      },
    ],
  },
  plugins: [
    new ModuleFederationPlugin({
      name: 'host',
      filename: 'remoteEntry.js',
      exposes: {},
      remotes: {
        products: 'products@http://localhost:3001/remoteEntry.js',
        cart: 'cart@http://localhost:3002/remoteEntry.js',
        user: 'user@http://localhost:3003/remoteEntry.js',
      },
      shared: {
        react: { singleton: true, eager: true, requiredVersion: '^18.2.0' },
        'react-dom': { singleton: true, eager: true, requiredVersion: '^18.2.0' },
        'react/jsx-runtime': { singleton: true, eager: true, requiredVersion: '^18.2.0' },
      },
    }),
    new HtmlWebpackPlugin({
      template: './public/index.html',
      filename: 'index.html',
    }),
  ],
  devServer: {
    port: 3000,
    historyApiFallback: true,
    hot: true,
    headers: {
      'Access-Control-Allow-Origin': '*',
    },
  },
};
