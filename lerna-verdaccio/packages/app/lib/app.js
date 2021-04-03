'use strict';
const { SERVER, EXPERIMENTAL } = require('@fa/base');
const { add, subtract } = require('@fa/lib');
const logger = require('@fa/log');

module.exports = app;

function app() {
  logger(`Current EXPERIMENTAL flag is ${EXPERIMENTAL}`);
  logger(`add "2 + 2" is ${add(2, 2)}`);
  logger(`subtract "4 - 2" is ${subtract(4, 2)}`);
  logger(`Server url is ${SERVER}`);
}

if (require.main === module) {
  app();
}
