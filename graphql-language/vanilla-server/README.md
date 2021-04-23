# Vanilla Graphql

Use graphql in a simple way along with [Graphql.js tutorial](https://graphql.org/graphql-js/)

```bash
# install the dependencies
yarn
```

## Examples

Execute one single query.

```bash
node ./query-executor.js
```

Running the server (express.js):

```bash
node ./server.js

open http://localhost:4000/graphql
# typing 'query {\n hello \n}'

# or using curl
curl 'http://localhost:4000/graphql?' \
  -H 'Content-Type: application/json' \
  --data-raw '{"query":"query {\n  hello\n}","variables":null}'

# running the client queries
node ./query-fetch1.js

node ./query-fetch2.js

node ./query-fetch3.js

node ./query-fetch4.js

node ./query-fetch5.js
```

## Server withou schema

Using JavaScript to create types for [schema](./server-without-schema.js#L14).

```bash
node server-without-schema.js

node ./query-fetch6.js
```

[Extensions in express-graphql](https://github.com/graphql/express-graphql#options): add more information in response.

[Apollo tracing](https://github.com/apollographql/apollo-server/tree/main/packages/apollo-tracing): collect and expose trace data in the Apollo Tracing format.

## Parse the schema text

[document on graphql.org](https://graphql.org/graphql-js/language/#parse)

```bash
node ./language.js

# printSchema
```

## Writing your own scalars

[document on graphql-tools](https://github.com/graphql/graphql-js/blob/4f4135507f6c9121e6bd3ffb29f946b69af31136/src/type/scalars.js)

[Custom `GraphQLScalarType` instance](https://www.graphql-tools.com/docs/scalars/#custom-graphqlscalartype-instance)

## Schema Directives

[document on graphql-tools](https://www.graphql-tools.com/docs/schema-directives).

> Since the GraphQL specification does not discuss any specific implementation strategy for directives, it's up to each GraphQL server framework to expose an API for implementing new directives.

[Custom directives using graphql-tools](https://www.graphql-tools.com/docs/schema-directives#implementing-schema-directives)
[Implementing directives in apollo-server](https://www.apollographql.com/docs/apollo-server/schema/creating-directives/)

## Schema merging

[document on graphql-tools](https://www.graphql-tools.com/docs/schema-merging)

## References

1. [graphql tools](https://www.graphql-tools.com/docs/introduction)

1. [apollo graphql](https://www.apollographql.com/docs/)
