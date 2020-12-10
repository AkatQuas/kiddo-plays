require('dotenv').config();
const { ApolloServer } = require('apollo-server');
const typeDefs = require('./schema');
const { createStore } = require('./utils');
const LaunchAPI = require('./datasources/launch');
const UserAPI = require('./datasources/user');
const resolvers = require('./resolvers');
const isEmail = require('isemail');

const store = createStore();

// set up any dataSources our resolvers need
const dataSources = () => ({
  launchAPI: new LaunchAPI(),
  /**
   * If you use this.context in a datasource,
   * it's critical to create a new instance in
   * the dataSources function, rather than sharing a single instance.
   * Otherwise, initialize might be called during
   * the execution of asynchronous code for a particular user,
   * replacing this.context with the context of another user.
   */
  userAPI: new UserAPI({ store }),
});

/**
 * The return value of this function
 * becomes the context argument that's passed to
 * every resolver that runs as part of that operation.
 */
const context = async ({ req }) => {
  // simple auth verification on each request
  const auth = (req.headers && req.headers.authorization) || '';
  const email = Buffer.from(auth, 'base64').toString('ascii');
  if (!isEmail.validate(email)) {
    return { user: null };
  }

  const users = await store.users.findOrCreate({ where: { email } });
  const user = (users && users[0]) || null;
  return {
    user: Object.assign({}, user.dataValues),
  };
};

const server = new ApolloServer({
  introspection: process.env.NODE_ENV !== 'production',
  typeDefs,
  resolvers,
  dataSources,
  context,
  playground: true,
  apollo: {
    graphVariant: 'current',
  },
});

if (process.env.NODE_ENV !== 'test') {
  server.listen().then(({ url }) => {
    console.log(`\tServer running at ${url} `);
  });
}

module.exports = {
  dataSources,
  context,
  typeDefs,
  ApolloServer,
  LaunchAPI,
  UserAPI,
  store,
  server,
};
