import * as MJ from 'merge-json';
import { parse } from '@iarna/toml';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

export const loadConfig = () => {
  const configList = [
    resolve(__dirname, '../../../shared/config.example.toml'),
    resolve(__dirname, './config.toml'),
  ];

  const config = configList.reduce(
    (conf, file) => {
      if (!existsSync(file)) {
        return conf;
      }

      const text = readFileSync(file).toString();
      const parsed = parse(text);
      return MJ.merge(conf, parsed);
    },
    {}
  );

  return config;
};
