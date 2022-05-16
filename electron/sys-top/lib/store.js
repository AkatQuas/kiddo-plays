const electron = require('electron');
const path = require('path');
const fs = require('fs');

class Store {
  constructor(options) {
    const userDataPath = electron.app.getPath('userData');
    this.path = path.resolve(userDataPath, `${options.configName}.json`);
    this.data = parseDataFile(this.path, options.defaults);
  }

  get(key) {
    return this.data[key];
  }

  set(key, val) {
    this.data[key] = val;
    fs.writeFileSync(this.path, JSON.stringify(this.data));
  }
}

function parseDataFile(filePath, defaults) {
  try {
    return JSON.parse(fs.readFileSync(filePath).toString());
  } catch (_) {
    return defaults;
  }
}

module.exports.Store = Store;
