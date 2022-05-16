// @ts-check
module.exports.isDev = process.env.NODE_ENV !== 'production';
module.exports.isMac = process.platform === 'darwin';
