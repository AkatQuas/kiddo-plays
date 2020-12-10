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

const resolvers = {
  Query: {
    book: (parent, args) => {
      const { id } = args;
      const candidate = books.filter(item => item.id === id);
      return candidate.length ? candidate[0] : null;
    },
    books: () => books,
    hello: () => 'world',
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
    },
  },
  MutationResponse: {
    __resolveType: () => null,
  },
};

module.exports = resolvers;
