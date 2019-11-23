const { GraphQLServer } = require('graphql-yoga');

const links = [
  { id: 'link-0', url: 'www.howto.com', description: 'a link 0' }
];
let idCount = links.length;
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
    link: (root, args) => {
      const { id } = args;
      for (let index = 0; index < links.length; index++) {
        const element = links[index];
        if (element.id === id) {
          return element;
        }
      }
      return null;
    }
  },
  Mutation: {
    post: (parent, args) => {
      const link = {
        id: `link-${idCount++}`,
        description: args.description,
        url: args.url
      };
      links.push(link);
      return link;
    },
    deleteLink: (root, args) => {
      const { id } = args;
      const idx = links.findIndex(item => item.id === id);
      if (idx === -1) {
        return null;
      }
      const link = links.splice(idx, 1)[0];
      return link;
    },
    updateLink: (root, args) => {
      const { id, description, url } = args;
      const idx = links.findIndex(item => item.id === id);
      if (idx === -1) {
        return null;
      }
      const el = links[idx];
      el.description = description || el.description;
      el.url = url || el.url;
      return el;
    }
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
    url: parent => parent.url
  }
};

/*
Finally, the schema and resolvers are bundled and passed to the `GraphQLServer` which is imported from `graphql-yoga`. This tells the server what API operations are accepted and how they should be resolved.
 */
const server = new GraphQLServer({
  typeDefs: './src/schema.graphql',
  resolvers
});

server.start(() => console.log(`Server is running at http://localhost:4000`));
