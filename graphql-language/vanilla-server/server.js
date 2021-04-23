import { randomBytes } from 'crypto';
import express from 'express';
import { graphqlHTTP } from 'express-graphql';
import { buildSchema } from 'graphql';
import { GraphQLDate, GraphQLJSON, GraphQLVoid } from 'graphql-scalars';
import { loggingMiddleware } from './utils/middleware.js';
import { Message, RandomDie } from './utils/objects.js';

const schema = buildSchema(`
  scalar JSON
  scalar Date
  scalar Void

  directive @deprecated(
    reason: String = "No longer supported"
  ) on FIELD_DEFINITION | ENUM_VALUE

  type Ip {
    ip: String @deprecated(reason: "don't use ip")
  }
  type Book {
    title: String
    author: String
  }
  type RandomDie {
    numSides: Int!
    rollOnce: Int!
    roll(numRolls: Int!): [Int]
  }

  input MessageInput {
    content: String
    author: String
  }

  type Message {
    id: ID!
    content: String
    author: String
  }

  type Query {
    ip: Ip
    hello: String
    book: Book
    rollDice(numDice: Int!, numSides: Int): [Int]
    getDie(numSides: Int): RandomDie
    message: String
    getMessage(id: ID!): Message
    getJson: JSON
    getDate: Date
    getVoid: Void
  }
  type Mutation {
    setMessage(message: String!): String
    createMessage(input: MessageInput!): Message
    updateMessage(id: ID!, input: MessageInput): Message
  }
`);

const fakeDatabase = {};

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
  rollDice: ({ numDice, numSides }, request, response) => {
    const result = [];
    for (let i = 0; i < numDice; i++) {
      result.push(~~(Math.random() * numSides) + 1);
    }
    return result;
  },
  getDie: ({ numSides }) => {
    return new RandomDie(numSides || 6);
  },
  setMessage: ({ message }) => {
    fakeDatabase.message = message;
    return message;
  },
  message: () => {
    return fakeDatabase.message;
  },
  getMessage: ({ id }) => {
    if (!fakeDatabase[id]) {
      throw new Error(`no message exists with id "${id}"`);
    }
    return new Message(id, fakeDatabase[id]);
  },
  createMessage: ({ input }) => {
    // Create a random id for the fake database.
    const id = randomBytes(10).toString('hex');
    fakeDatabase[id] = input;
    return new Message(id, input);
  },
  updateMessage: ({ id, input }) => {
    if (!fakeDatabase[id]) {
      throw new Error(`no message exists with id "${id}"`);
    }
    fakeDatabase[id] = input;
    return new Message(id, input);
  },
  ip: (args, request) => {
    return { ip: request.ip };
  },
  getJson: () => {
    return {
      b: 'a',
    };
  },
  getDate: () => {
    return new Date();
  },
  getVoid: () => {
    return void 0;
  },
};

const app = express();
app.use(loggingMiddleware);
app.use(
  '/graphql',
  graphqlHTTP({
    schema,
    rootValue: root,
    graphiql: true,
    typeResolver: {
      // custome scalars
      JSON: GraphQLJSON,
      Date: GraphQLDate,
      Void: GraphQLVoid,
    },
    extensions: ({ operationName, result, context }) => {
      console.log(`operation ${operationName} worked`);
      console.log(` result->`, result);
      // console.log(` context->`, context);
      return {
        good: true,
      };
    },
  })
);

app.listen(4000, () => {
  console.log('Server running at 4000 🚀 !');
});
