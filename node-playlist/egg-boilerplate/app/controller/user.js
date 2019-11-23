'use strict';
const Base = require('./base');
const jwt = require('jsonwebtoken');
const moment = require('moment');
const constants = require('../utils/constants');

class UserController extends Base {
    logout() {
        const { ctx } = this;
        ctx.cookies.set('token', null, {
            overwrite: true
        });
        this.success();
    }
    async login() {
        const { ctx } = this;
        const { username, password } = ctx.request.body;
        // todo await talking to database

        const data = await ctx.service.user.findPasswordByUsername(username);

        if (!data || !data.dataValues) {
            // user doesn't exist
            this.error('用户名或密码不正确', 422);
            return false;
        }
        if (data.dataValues.password !== utils.md5(password)) {
            // wrong password
            this.error('用户名或密码不正确', 422);
            return false;
        }
        const { dataValues } = data;

        const expiration = moment(moment().add(30, 'd').format('YYYY-MM-DD 00:00:00')).unix();
        const token = jwt.sign({
            username,
            userId: dataValues.id,
            sub: dataValues.id,
            iat: moment().unix(),
            exp: expiration
        }, constants.jwtSecret);
        ctx.cookies.set('token', token, {
            httpOnly: true,
            path: '/',
            expires: moment.utc(moment().add(30, 'd').format('YYYY-MM-DD 00:00:00')).toDate(),
        });
        this.success();
    }
}

module.exports = UserController;