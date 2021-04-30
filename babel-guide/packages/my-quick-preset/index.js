// my-quick-preset
const { declare } = require('@babel/helper-plugin-utils');

const logger = (...msg) => {
  console.log(`[quick-preset] `, ...msg);
};

module.exports = declare((api, opts) => {
  logger('opts ->', opts);
  return {
    plugins: [],
  };
});
