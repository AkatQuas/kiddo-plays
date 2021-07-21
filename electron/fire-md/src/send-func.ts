import { CrashReporterStartOptions } from 'electron';
import request from 'request';
import manifest from '../package.json';

const host = `http://localhost:8080`;
export const config: CrashReporterStartOptions = {
  productName: 'Fire MD',
  companyName: 'Electron Wasa',
  submitURL: `${host}/crashreports`,
  uploadToServer: true,
};

export const sendUncaughtException = (error: any): void => {
  const { productName, companyName } = config;
  console.log(`xedlog error ->`, error, productName);
  request.post(`${host}/uncaughtexceptions`, {
    form: {
      _productName: productName,
      _companyName: companyName,
      _version: manifest.version,
      platform: process.platform,
      ver: process.versions.electron,
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack,
      },
    },
  });
};
