'use strict';

const { Service } = require('egg');
const modelResult = require('../utils/model-result');

class UserService extends Service {
    async findAll() {
        const { ctx } = this;
        try {
            const raw = ctx.model.User.findAll({
                raw: true,
                where: {
                    soft_delete: 0
                },
                attributes: {
                    exclude: ['create_time', 'update_time']
                }
            });
            return modelResult.success(raw);
        } catch (e) {
            return modelResult.error('failed to list all user');
        }
    }

    async findPasswordByUsername(username) {
        // talking to database
        const { ctx } = this;
        try {
            const raw = await ctx.model.User.findOne({
                attributes: ['id', 'password'],
                where: {
                    username,
                    soft_delete: 0,
                },
            });
            return modelResult.success(raw);
        } catch (e) {
            return modelResult.error('no such user');
        }
    }
}

module.exports = UserService;
