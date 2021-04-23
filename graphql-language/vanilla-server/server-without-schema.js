import express from 'express';
import { graphqlHTTP } from 'express-graphql';
import graphql from 'graphql';
import { loggingMiddleware } from './utils/middleware.js';
import { User } from './utils/objects.js';

// Maps id to User object
const fakeDatabase = {
  a: new User('a', 'alice'),
  b: new User('b', 'bob'),
};

// equivalent schemaText
const schemaText = `
  type User {
    id: String
    name: String
  }

  type Query {
    ip: String
    user(id: String!): User
  }
`;

// Define the User type
const userType = new graphql.GraphQLObjectType({
  name: 'User',
  fields: {
    id: { type: graphql.GraphQLString },
    name: { type: graphql.GraphQLString },
  },
});

// Define the Query type
const queryType = new graphql.GraphQLObjectType({
  name: 'Query',
  fields: {
    ip: {
      type: graphql.GraphQLString,
      resolve: (_, args, request) => {
        return request.ip;
      },
    },
    user: {
      type: userType,
      // `args` describes the arguments that the `user` query accepts
      args: {
        id: { type: graphql.GraphQLString },
      },
      resolve: (_, { id }) => {
        return fakeDatabase[id];
      },
    },
  },
});

const app = express();
app.use(loggingMiddleware);
app.use(
  '/graphql',
  graphqlHTTP({
    schema: new graphql.GraphQLSchema({ query: queryType }),
    graphiql: true,
  })
);
app.listen(4400, () => {
  console.log('Running a GraphQL API server at http://localhost:4400/graphql');
});
