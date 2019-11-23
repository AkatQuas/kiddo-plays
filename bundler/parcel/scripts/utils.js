const path = require('path');

module.exports = {
  resolveRoot: (...dir) => path.resolve(__dirname, '..', ...dir),
}