'use strict';
const path = require('path');

module.exports = appInfo => {
  const config = exports = {};

  // use for cookie sign key, should change to your own and keep security
  config.keys = appInfo.name + '_1544501154082_4061';

  // add your config here
  config.middleware = [
    'auth'
  ];

  config.security = {
    csrf: {
      ignore: () => true
    }
  }

  config.onerror = {
    all(err, ctx) {
      ctx.status = 500;
      ctx.set('Content-Type', 'application/json');
      ctx.body = JSON.stringify(response.simpleError('系统错误，请重试'));
    },
  };

  config.validate = {
    // widelyUndefined: true,
    // convert: false,
    // validateRoot: false,
  };
  config.customLogger = {
    httpRequestLogger: {
      file: path.join(appInfo.root, `opt/logs/nodejs/${appInfo.name}-request.log`),
    },
    proxyLogger: {
      file: path.join(appInfo.root, `opt/logs/nodejs/${appInfo.name}-proxy.log`),
    },
  };

  return config;
};
