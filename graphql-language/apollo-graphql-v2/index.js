const { ApolloServer, gql } = require('apollo-server');

const books = [
  {
    id: 0,
    title: 'Harry Potter and the Chamber of Secrets',
    author: 'J.K. Rowling',
  },
  {
    id: 1,
    title: 'Jurassic Park',
    author: 'Michael Crichton',
  },
];
let idGen = books.length;
const bookGen = ({ title, author }) => ({ title, author, id: idGen++ });

const typeDefs = gql`
  # Comments in GraphQL are defined with the hash (#) symbol.

  # This "Book" type can be used in other type declarations.
  type Book {
    id: Int!
    title: String!
    author: String!
  }

  # "interface" for re-use the ObjectType schema
  interface MutationResponse {
    code: String!
    success: Boolean!
    message: String
  }
  type AddBookMutation implements MutationResponse {
    code: String!
    success: Boolean!
    message: String
    book: Book!
  }

  # "input" for re-use the InputType schema
  input AddBookInput {
    # main title for the book
    title: String!
    author: String!
  }

  # The "Query" type is the root of all GraphQL queries.
  # (A "Mutation" type will be covered later on.)
  type Query {
    book(id: Int!): Book
    books: [Book]
    hello: String
  }
  type Mutation {
    addBook(title: String!, author: String!): Book

    addBookWithResponseFormat(title: String!, author: String!): AddBookMutation!

    addBookWithInput(book: AddBookInput!): AddBookMutation!
  }
`;

const resolvers = {
  Query: {
    book: (parent, args) => {
      const { id } = args;
      const candidate = books.filter(item => item.id === id);
      return candidate.length ? candidate[0] : null
    },
    books: () => books,
    hello: () => 'world'
  },
  Mutation: {
    addBook: (parent, args, ctx, info) => {
      const { title, author } = args;
      const book = bookGen({ title, author });
      books.push(book);
      return book;
    },
    addBookWithResponseFormat: (parent, args, ctx, info) => {
      const { title, author } = args;
      const book = bookGen({ title, author });
      books.push(book);
      return { code: '200', success: true, book, message: '' };
    },
    addBookWithInput: (parent, args, ctx, info) => {
      const { title, author } = args.book;
      const book = bookGen({ title, author });
      books.push(book);
      return { code: '200', success: true, book, message: '' };
    }
  },
  MutationResponse: {
    __resolveType: () => null
  }
};

const server = new ApolloServer({ typeDefs, resolvers });

// This `listen` method launches a web-server.  Existing apps
// can utilize middleware options, which we'll discuss later.
server.listen().then(({ url }) => {
  console.log(`\n🚀  Server ready at ${url}`);
});
