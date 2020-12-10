const { gql } = require('apollo-server');

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

module.exports = typeDefs;
