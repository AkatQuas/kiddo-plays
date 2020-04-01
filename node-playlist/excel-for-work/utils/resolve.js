const path = require('path');

const resolve = (...dir) => path.resolve(__dirname, '..', ...dir);
const resolveDB = (...dir) => resolve('database', ...dir);

module.exports = resolve;
module.exports.resolveDB = resolveDB;