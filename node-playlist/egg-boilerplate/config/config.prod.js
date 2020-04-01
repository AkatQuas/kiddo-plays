'use strict';

module.exports = appInfo => {
  const config = exports = {};

  // use for cookie sign key, should change to your own and keep security
  config.keys = appInfo.name + '_1544501154082_4061';

  // add your config here
  config.middleware = [];

  config.sequelize = {
    dialect: 'mysql',
    database: 'demo',
    host: 'localhost',
    port: 3306,
    username: 'root',
    password: 'root',
    timezone: '+08:00',
    define: {
      freezeTableName: true,
      timestamps: false
    },
  }
  
  config.logger = {
    consoleLevel: 'INFO',
    dir: '/opt/logs/nodejs',
    appLogName: `${appInfo.name}-app.log`, // 应用相关日志，供应用开发者使用的日志。我们在绝大数情况下都在使用它
    coreLogName: `${appInfo.name}-core.log`, // 框架内核、插件日志
    agentLogName: `${appInfo.name}-agent.log`, // agent 进程日志，框架和使用到 agent 进程执行任务的插件会打印一些日志到这里。
    errorLogName: `${appInfo.name}-error.log`, // 实际一般不会直接使用它，任何 logger 的 .error() 调用输出的日志都会重定向到这里，重点通过查看此日志定位异常。
  };
  return config;
};
