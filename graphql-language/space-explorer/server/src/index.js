require('dotenv').config();
const { RedisCache } = require('apollo-server-cache-redis');
const { ApolloServer, AuthenticationError } = require('apollo-server');
const typeDefs = require('./schema');
const { createStore } = require('./utils');
const LaunchAPI = require('./datasources/launch');
const UserAPI = require('./datasources/user');
const resolvers = require('./resolvers');
const isEmail = require('isemail');
const {
  UpperCaseDirective,
  RestDirective,
  DateFormatDirective,
} = require('./directives');

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
  // optionally throw error
  // we could also check user roles/permissions here
  //  if (!user) {
  //    throw new AuthenticationError('you must be logged in');
  //  }
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
  cache: new RedisCache({
    host: 'localhost',
    port: '6379',
    enableReadyCheck: true,
  }),
  schemaDirectives: {
    upper: UpperCaseDirective,
    rest: RestDirective,
    date: DateFormatDirective,
  },
  formatError: (err) => {
    // Don't give the specific errors to the client.
    if (err.message.startsWith('Database Error: ')) {
      return new Error('Internal server error');
    }
    // Otherwise return the original error.  The error can also
    // be manipulated in other ways, so long as it's returned.
    return err;
  },
  apollo: {
    graphVariant: 'current',
  },
  onHealthCheck: () => {
    return new Promise((resolve, reject) => {
      // Replace the `true` in this conditional with more specific checks!
      if (Math.random() > 0.5) {
        // status code 200 OK
        resolve();
      } else {
        // status code 503 Service Unavailable
        reject();
      }
    });
  },
});

if (process.env.NODE_ENV !== 'test') {
  server.listen().then(({ url }) => {
    console.log(`🚀 Server ready at ${url}`);
    console.log(
      `Try your health check at: ${url}.well-known/apollo/server-health`
    );
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
