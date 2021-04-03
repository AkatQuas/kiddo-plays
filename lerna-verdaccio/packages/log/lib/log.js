'use strict';

module.exports = log;

/**
 * logger for all
 * @param  {...any} args
 */
function log(...args) {
  console.log(`@fa ->`, ...args);
}
