const path = require('path')

const Koa = require('koa');
const app = new Koa();
const serve = require('koa-static')

const composed = require('./middleware/composed')
const { responseTime, logger } = require('./middleware')
const errorHandler = require('./error-handler')

const publicFiles = serve(path.resolve(__dirname, 'public'))

app.use(errorHandler)

app.use(publicFiles)

app.use(responseTime);

app.use(logger(':method with url :url'));

app.use(composed)

app.use(ctx => {
    ctx.body = 'Hello Koa';
});

app.listen(3033, _ => {
    console.log('> listening at http://localhost:3033/  ')
})