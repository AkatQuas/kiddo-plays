/**
 * Module Federation Configuration Factory
 * Creates webpack Module Federation plugin configurations for both hosts and remotes
 */

import './webpack.common';

export interface FederationConfigOptions {
  name: string;
  exposes?: Record<string, string>;
  remotes?: Record<string, string>;
  shared?: Record<string, { singleton: boolean; eager: boolean; requiredVersion: string }>;
}

/**
 * Generate Module Federation plugin configuration
 */
export function getFederationConfig(options: FederationConfigOptions) {
  const { name, exposes = {}, remotes = {}, shared = {} } = options;

  // Default shared dependencies (React ecosystem)
  const defaultShared: Record<string, { singleton: boolean; eager: boolean; requiredVersion: string }> = {
    react: {
      singleton: true,
      eager: true,
      requiredVersion: '^18.2.0',
    },
    'react-dom': {
      singleton: true,
      eager: true,
      requiredVersion: '^18.2.0',
    },
    'react/jsx-runtime': {
      singleton: true,
      eager: true,
      requiredVersion: '^18.2.0',
    },
  };

  // Merge user-provided shared config with defaults
  const mergedShared = { ...defaultShared, ...shared };

  return {
    name,
    filename: 'remoteEntry.js',
    exposes,
    remotes,
    shared: mergedShared,
  };
}

/**
 * Create host (consumer) federation config
 */
export function createHostConfig(options: Omit<FederationConfigOptions, 'exposes'>) {
  return getFederationConfig({
    ...options,
    exposes: {}, // Host doesn't expose anything
  });
}

/**
 * Create remote (provider) federation config
 */
export function createRemoteConfig(options: Omit<FederationConfigOptions, 'remotes'>) {
  return getFederationConfig({
    ...options,
    remotes: {}, // Remote doesn't consume from others
  });
}

/**
 * Common webpack configuration for both host and remote apps
 */
export function getCommonWebpackConfig(isDevelopment = true): import('./webpack.common').WebpackConfigurationWithDevServer {
  return {
    mode: isDevelopment ? 'development' : 'production',
    devtool: isDevelopment ? 'eval-source-map' : 'source-map',
    resolve: {
      extensions: ['.tsx', '.ts', '.jsx', '.js'],
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
    plugins: [],
    devServer: {
      port: 3000,
      historyApiFallback: true,
      hot: true,
      headers: {
        'Access-Control-Allow-Origin': '*',
      },
    },
  };
}

export default { getFederationConfig, createHostConfig, createRemoteConfig, getCommonWebpackConfig };
