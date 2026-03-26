/**
 * Common Webpack Configuration
 * Shared webpack settings for all apps in the monorepo
 */

import path from 'path';
import type { Configuration } from 'webpack';

// Extend Configuration to include devServer (from webpack-dev-server)
export interface WebpackConfigurationWithDevServer extends Configuration {
  devServer?: {
    static?: { directory: string };
    compress?: boolean;
    port?: number;
    hot?: boolean;
    historyApiFallback?: boolean;
    headers?: Record<string, string>;
  };
}

export interface CommonWebpackOptions {
  isDevelopment?: boolean;
  outputPath?: string;
  entryPath?: string;
}

export function getDefaultCommonWebpackConfig(
  options: CommonWebpackOptions = {}
): WebpackConfigurationWithDevServer {
  const {
    isDevelopment = true,
    outputPath = path.resolve(process.cwd(), 'dist'),
    entryPath = path.resolve(process.cwd(), 'src/index.ts')
  } = options;

  return {
    mode: isDevelopment ? 'development' : 'production',
    entry: entryPath,
    output: {
      path: outputPath,
      filename: isDevelopment ? '[name].js' : '[name].[contenthash].js',
      publicPath: 'auto',
      clean: true
    },
    resolve: {
      extensions: ['.tsx', '.ts', '.jsx', '.js'],
      alias: {
        '@': path.resolve(process.cwd(), 'src')
      }
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
                ['@babel/preset-react', { runtime: 'automatic' }]
              ]
            }
          }
        },
        {
          test: /\.css$/,
          use: ['style-loader', 'css-loader', 'postcss-loader']
        },
        {
          test: /\.(png|svg|jpg|jpeg|gif)$/i,
          type: 'asset/resource'
        }
      ]
    },
    devtool: isDevelopment ? 'eval-source-map' : 'source-map',
    devServer: {
      static: {
        directory: outputPath
      },
      compress: true,
      port: 3000,
      hot: true,
      historyApiFallback: true,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods':
          'GET, POST, PUT, DELETE, PATCH, OPTIONS',
        'Access-Control-Allow-Headers':
          'X-Requested-With, content-type, Authorization'
      }
    },
    optimization: {
      splitChunks: {
        chunks: 'all',
        cacheGroups: {
          vendor: {
            test: /[\\/]node_modules[\\/]/,
            name: 'vendors',
            chunks: 'all'
          }
        }
      }
    }
  };
}

export default getDefaultCommonWebpackConfig;
