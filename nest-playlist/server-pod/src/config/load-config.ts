import * as MJ from 'merge-json';
import { parse } from '@iarna/toml';
import { readFileSync } from 'fs';
import { resolve } from 'path';


export const loadConfig = () => {
  const configList = [
    resolve(__dirname, '../../config/config.example.toml'),
    resolve(__dirname, '../../config/config.toml'),
  ];

  const config = configList.reduce(
    (conf, file) => {
      const text = readFileSync(file).toString();
      const parsed = parse(text);

      return MJ.merge(conf, parsed);
    },
    {}
  );

  return config;
}
