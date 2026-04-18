import path from 'node:path';
import { defineConfig, mergeConfig, type UserConfig } from 'vite';
import pkg from './package.json';

export const extendsBaseConfig = (overrides: UserConfig = {}) => {
  const isDev = process.env.NODE_ENV === 'development';
  const config: UserConfig = {
    resolve: {
      alias: {
        '@shared': path.resolve(__dirname, './src/shared'),
      },
    },
    define: {
      __ENV_SWITCH__: JSON.stringify(Boolean(process.env.ENV_SWITCH || isDev)),
      __APP_VERSION__: JSON.stringify(pkg.version),
    },
  };

  return defineConfig(mergeConfig(config, overrides));
};
