import { loadConfig } from './load-config';

function inspectConfig() {
  const config = loadConfig();
  console.log(config);
}

inspectConfig();
