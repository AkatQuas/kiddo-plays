import { parse } from '@iarna/toml';
import { createReadStream } from 'fs';
import merge from 'lodash/merge';
import { resolve } from 'path';
const debug = require('debug')('configuration');

const Product = resolve(process.cwd(), 'config.toml');
const Development = resolve(process.cwd(), 'config.development.toml');
const Test = resolve(process.cwd(), 'config.test.toml');

export interface Configuration {
  isDev: boolean;
  isProd: boolean;
  isTest: boolean;

  NODE_ENV: string;
  JWT_TOKEN: string;
  store: {
    mongo: string;
  };
}

export const configuration = async (): Promise<Configuration> => {
  const files = [Development];
  switch (process.env.NODE_ENV) {
    case 'production':
      files.push(Product);
      break;
    case 'test':
      files.push(Test);
      break;
    default:
      break;
  }

  const result = (
    await Promise.all(files.map((f) => parse.stream(createReadStream(f))))
  ).reduce((acc, config) => merge(acc, config), {});
  injectEnvironment(result);
  debug(result);
  return result as unknown as Configuration;
};

/**
 * Inject configuration in to process.env .
 * Inspired by {@link https://github.com/motdotla/dotenv dotenv}
 */
function injectEnvironment(config: Record<string, any>) {
  const hasOwnProperty = Object.prototype.hasOwnProperty;
  Object.entries(config).forEach(([key, value]) => {
    if (!hasOwnProperty.call(process.env, key)) {
      process.env[key] =
        typeof value === 'object' ? JSON.stringify(value) : value;
    } else {
      debug(
        `"${key}" is already defined in \`process.env\` and will not be overwritten`,
      );
    }
  });
}
