import { buildSchema, parse, printSchema } from 'graphql';

const schemaText = `
  scalar Date

  directive @deprecated(
    reason: String = "No longer supported"
  ) on FIELD_DEFINITION | ENUM_VALUE

  """
  description for user
  """
  type User {
    id: String
    age: Int
    name: String
  }

  """
  starship description
  """
  type Starship {
    name: String
  }

  interface Character {
    id: ID!
    name: String!
    friends: [Character]
    appearsIn: [Episode]!
  }

  type Human implements Character {
    id: ID!
    name: String!
    friends: [Character]
    starships: [Starship]
    appearsIn: [Episode]!
    totalCredits: Int
  }

  type Droid implements Character {
    id: ID!
    name: String!
    friends: [Character]
    appearsIn: [Episode]!
    primaryFunction: String
  }

  union SearchResult = Human | Droid

  enum Episode {
    NEWHOPE
    EMPIRE
    JEDI
  }

  type Query {
    ip: String @deprecated(reason: "don't use ip")
    user(id: String!): User
    search(id: ID!, name: String): SearchResult
  }
  type Mutation {
    createUser(name: String!): User
  }
`;

console.log(
  JSON.stringify(
    parse(schemaText, {
      noLocation: true,
    }),
    null,
    2
  )
);

function revert() {
  // print back the schema
  const builtSchema = buildSchema(schemaText);
  console.log(printSchema(builtSchema));
}
