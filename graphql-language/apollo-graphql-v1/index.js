const koa = require('koa');
const koaRouter = require('koa-router');
const koaBody = require('koa-bodyparser');
const { graphqlKoa, graphiqlKoa } = require('apollo-server-koa');
const schema = require('./schema');

const app = new koa();

const router = new koaRouter();

const PORT = 3000;

app.use(koaBody());
const graphqlInstance = graphqlKoa({ schema });

router.get('/hello', ctx => {
  ctx.body = 'world';
});
router.get('/world', ctx => {
  ctx.body = 'hello';
});
router.post('/graphql', graphqlInstance);
router.get('/graphql', graphqlInstance);

app.use(router.routes());
app.use(router.allowedMethods());

router.get(
  '/graphiql',
  graphiqlKoa({
    endpointURL: '/graphql',
  })
);

app.listen(PORT, () => {
  console.log(`🚀 listening at http://localhost:${PORT}/`);
});
