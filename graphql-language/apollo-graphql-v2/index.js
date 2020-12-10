const { ApolloServer } = require('apollo-server');
const resolvers = require('./resolvers');
const typeDefs = require('./schema');

const server = new ApolloServer({ typeDefs, resolvers });

// This `listen` method launches a web-server.  Existing apps
// can utilize middleware options, which we'll discuss later.
server.listen().then(({ url }) => {
  console.log(`\n🚀  Server ready at ${url}`);
});
