const chalk = require('chalk');

const logger = msg => console.log(msg);

logger['error'] = msg => console.log(chalk.bold.red(msg));
logger['success'] = msg => console.log(chalk.green(msg));
logger['warning'] = msg => console.log(chalk.yellow(msg));

module.exports = logger;