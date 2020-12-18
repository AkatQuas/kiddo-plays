# GraphQL

Learning the GraphQL.

## Quick notes

<details>
<summary>

Each `type` in schema should have a corresponding field definition in resolver. Those _Scalar_ type could be omitted unless you want to do some introspection.

</summary>

```graphql
## in schema
type Parent {
  name: String!
  children: [Child!]
}

type Child {
  name: String!
  toys: [Toy]
}

type Toy {
  name: String!
  createdAt: Date
}

type Query {
  parent(name: String!): Parent
  child(name: String!): Child
  toy(name: String!): Toy
}
```

```js
// in reslovers
module.exports = {
  // Query is defined in the top type level
  Query: {
    // there is a field `parent` in the type Query
    parent: (root, args) => {
      return new Parent(/* params */);
    },
    // there is a field `child` in the type Query
    child: (root, args) => {
      return new Child(/* params */);
    },
    // there is a field `toy` in the type Query
    toy: (root, args) => {
      return new Toy(/* params */);
    },
  },

  // Parent is defined in the top type level
  Parent: {
    /* optional for scalar type */
    name: (root, args) => root.name,

    /* the children field is used for query for the list of child, and it's recommend to declare it */
    children: (root, args) => {
      /* do something with the nested args */
      return [new Child(), new Child()];
    },
  },

  // Child is defined in the top type level
  Child: {
    toys: (parent, args) => {
      /* do something with the nested args */
      return [new Toy(), new Toy()];
    },
  },

  // Toy is defined in the top type level
  Toy: {
    createdAt: (parent, args) => {
      /* do something with the nested args */
      return new Date();
    },
  },
};
```

</details>

## Example Projects

[quick-apollo](./quick-apollo): Use `@apollo/client` with `React`, focusing on frontend usage.

[space-explorer](./space-explorer): Full-stack apps with Apollo, `React` in frontend, `sqlite`, and `apollo-server` in the backend.

## Useful Links

- [Official GraphQL document](https://graphql.org/learn/).

- [Apollo graphql](https://www.apollographql.com/).

  - [writing a sceham](https://www.apollographql.com/docs/apollo-server/essentials/schema.html)

    _ObjectType_

    _Response Format_

    _Input Type_

  - [building a server](https://www.apollographql.com/docs/apollo-server/essentials/server.html)

    It has something about the middlewares.

  - [fetchig data with resolvers](https://www.apollographql.com/docs/apollo-server/essentials/data.html)

    [_Resolvers results_](https://www.apollographql.com/docs/apollo-server/essentials/data.html#result):

    > related: [How graphql execute the Query](https://blog.apollographql.com/graphql-explained-5844742f195e)
    >
    > related: [Dataloader for caching](https://github.com/facebook/dataloader#using-with-graphql)

    [_Parent argument_](https://www.apollographql.com/docs/apollo-server/essentials/data.html#parent): Every GraphQL query is a tree of function calls in the server.

    [_Context argument_](https://www.apollographql.com/docs/apollo-server/essentials/data.html#context): The context is how you access your shared connections and fetchers in resolvers to get data.

    [_Info argument_](https://www.prisma.io/blog/graphql-server-basics-demystifying-the-info-argument-in-graphql-resolvers-6f26249f613a): What is the `info` argument in the last position??

- [GraphQL yoga](https://github.com/prisma/graphql-yoga/)
