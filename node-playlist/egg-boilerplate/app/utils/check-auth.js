const jwt = require('jsonwebtoken');
const Logger = require('egg-logger').Logger;
const constants = require('./constants');

const logger = new Logger();

module.exports = function chekcAuth(token) {
    try {
        return jwt.verify(token, constants.jwtSecret);
    } catch (error) {
        logger.error(error.message);
        return false;
    }
}