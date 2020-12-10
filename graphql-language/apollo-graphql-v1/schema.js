const { makeExecutableSchema } = require('graphql-tools');

// Some fake data
const books = [
  {
    title: "Harry Potter and the Sorcerer's stone",
    author: 'J.K. Rowling',
  },
  {
    title: 'Jurassic Park',
    author: 'Michael Crichton',
  },
];

const typeDefs = `
  type Query {
    books(id: Int): [Book]
  }
  type Book {
    title: String
    author: String
  }
  type Mutation {
    addBook(title: String!, author: String!): Book
  }
`;

const resolvers = {
  Query: {
    books: (_, args, ctx, __) => {
      console.log(args);
      return books;
    },
  },
  Mutation: {
    addBook: (_, args, ctx, __) => {
      const { title, author } = args;
      const item = { title, author };
      books.push(item);
      return item;
    },
  },
};

const schema = makeExecutableSchema({
  typeDefs,
  resolvers,
});

module.exports = schema;
