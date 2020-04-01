
const responseTime = async (ctx, next) => {
    const start = Date.now();
    await next();
    const ms = Date.now() - start;
    ctx.set('X-Response-Time', `${ms}ms`)
}

const logger = format => {
    format = format || ':method ":url"';
    const logger = async (ctx, next) => {
        const start = Date.now();
        await next();
        const ms = Date.now() - start;
        const str = format.replace(':method', ctx.method).replace(':url', ctx.url) + ` - ${ms}ms`;
        console.log(str)
    }
    return logger
}

module.exports = {
    responseTime,
    logger
}