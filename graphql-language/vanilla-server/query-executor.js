import { buildSchema, graphql } from 'graphql';

const schema = buildSchema(`
  type Book {
    title: String
    author: String
  }
  type Query {
    hello: String
    book: Book
  }
`);

const root = {
  hello: () => {
    return 'Hello, 42!';
  },
  book: () => {
    return {
      title: 'Book title',
      author: 'Tolkin',
    };
  },
};

graphql(schema, '{ hello \n book { title } }', root).then((response) => {
  console.log(response);
});
