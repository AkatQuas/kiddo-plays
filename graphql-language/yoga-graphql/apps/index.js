const { GraphQLServer } = require('graphql-yoga');
const { prisma } = require('./generated/prisma-client');
const Query = require('./resolvers/Query');
const Mutation = require('./resolvers/Mutation');
const User = require('./resolvers/User');
const Link = require('./resolvers/Link');
const Subscription = require('./resolvers/Subscription');
const Vote = require('./resolvers/Vote');

const server = new GraphQLServer({
  typeDefs: './apps/schema.graphql',
  resolvers: {
    Query,
    Mutation,
    Subscription,
    Link,
    User,
    Vote,
  },
  context: req => ({ ...req, prisma }),
});

server.start(() => console.log(`Server is running at http://localhost:4000`));
