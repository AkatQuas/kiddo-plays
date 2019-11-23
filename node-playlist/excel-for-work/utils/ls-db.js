const fs = require('fs-extra');
const logger = require('./logger');

module.exports = async dir => {
    const list = await fs.readdir(dir);

    const fileReg = /^\d{4}.*\.json$/;
    const files = list.filter(name => fileReg.test(name)).sort();

    if (!files.length) {
        logger.warning(`We have no report file in the ${dir}`);
        process.exit(0);
    }
    return files;
};