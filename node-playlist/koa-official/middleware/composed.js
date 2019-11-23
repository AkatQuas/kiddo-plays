const compose = require('koa-compose')

const random = async (ctx, next) => {
    if ('/random' === ctx.path) {
        ctx.body = ~~(Math.random() * 10)
    } else {
        await next();
    }
}

const backwards = async (ctx, next) => {
    if ('/backwards' == ctx.path) {
        ctx.body = 'sdrawkcab';
    } else {
        await next()
    }
}

const pi = async (ctx, next) => {
    if ('/pi' == ctx.path) {
        const e = new Error('a pi error')
        e.status = 425;

        // throw e;
        throw {
            statusCode: 403,
            message: 'a 499 error'
        };
        ctx.body = String(Math.PI)
    } else {
        await next()
    }
}

module.exports = compose([random, backwards, pi]) 