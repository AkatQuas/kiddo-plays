const { GraphQLServer } = require('graphql-yoga');

const links = [{ id: 'link-0', url: 'www.howto.com', description: 'a link 0' }];

/*
The `typeDefs` constant defines your GraphQL schema (more about this in a bit). Here, it defines a simple `Query` type with one field called `info`. This field has the type `String!`. The exclamation mark in the type definition means that this field can never be `null`.
 */
const typeDefs = `
type Query {
  info: String!
  feed: [Link!]!
}

type Mutation {
  post(url: String!, description; String!): Link!
}

type Link {
  id: ID!
  description: String!
  url: String!
}
`;
/*
The `resolvers` object is the actual implementation of the GraphQL schema. Notice how its structure is identical to the structure of the type definition inside `typeDefs`: `Query.info`.
 */
const resolvers = {
  Query: {
    info: () => `This is the API of a Hackernews Clone`,
    feed: (root, args, ctx, info) => {
      console.log('root ->', root);
      console.log('args -> ', args);
      console.log('ctx -> ', ctx);
      console.log('info -> ', info);
      return links;
    },
  },
  Link: {
    id: (parent, args, ctx, info) => {
      console.log('parent -> ', parent);
      console.log('args -> ', args);
      console.log('ctx -> ', ctx);
      console.log('info -> ', info);
      return parent.id;
    },
    description: parent => parent.description,
    url: parent => parent.url,
  },
};

/*
Finally, the schema and resolvers are bundled and passed to the `GraphQLServer` which is imported from `graphql-yoga`. This tells the server what API operations are accepted and how they should be resolved.
 */
const server = new GraphQLServer({
  typeDefs,
  resolvers,
});

server.start(() => console.log(`Server is running at http://localhost:4000`));
