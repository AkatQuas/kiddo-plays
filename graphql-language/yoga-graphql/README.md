# Hackernews node

A project on GraphQL, [tutorial](https://www.howtographql.com/graphql-js/1-getting-started/).

Main dependencies: [graphql-yoga](https://github.com/prisma/graphql-yoga/), [prisma](https://www.prisma.io/).

## Installation

```bash
yarn
```

## Development

```bash
yarn dev
```

## Guides

In server side we have several **Schema**s like:

```graphql
type User {
  id: ID!
  name: String!
}

type Query {
  users: [User!]!
  user(id: ID!): User
}

type Mutation {
  createUser(name: String!) User!
}
```

In client sied we can call the API with these operation:

```graphql
# Query for all users
query {
  users {
    id
    name
  }
}

# Query a single user by their id
query {
  user(id: "user-1") {
    id
    name
  }
}

# Create a new user
mutation {
  createUser(name: "Bob") {
    id
    name
  }
}
```

So remember this:

> In general, when adding a new feature to the API, the process will look pretty similar every time:
>
> Extend the GraphQL schema definition with a new root field (and new data types, if needed)
> Implement corresponding resolver functions for the added fields
> This process is also referred to as schema-driven or schema-first development.

[**on Subscription**](https://www.howtographql.com/graphql-js/7-subscriptions/)

[**on Filtering, Pagination, and Sorting**](https://www.howtographql.com/graphql-js/8-filtering-pagination-and-sorting/)

> Beside [Prisma](https://www.prisma.io/), you can have an alternative way or layer for database connecting.
