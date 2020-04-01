'use strict';
const checkAuth = require('../utils/check-auth');

const urlWhiteList = [
    '/api/login',
    '/api/create'
];

module.exports = options => {
    return async function auth(ctx, next) {
        if (urlWhiteList.find(ctx.url)) {
            await next();
            return;
        }
        const token = ctx.cookies.get('token', {
            signed: false
        });
        const data = checkAuth(token);
        if (!data) {
            ctx.status = 401;
            ctx.body = {
                success: false,
                code: '401',
                message: '权限不足'
            };
            return;
        }
        ctx.base = data;
        await next();
    }
}