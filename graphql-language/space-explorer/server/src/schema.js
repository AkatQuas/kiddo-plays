const { gql } = require('apollo-server');

// Schema
const typeDefs = gql`
  scalar Date
  interface BaseResponse {
    success: Boolean!
    message: String
  }
  enum PatchSize {
    SMALL
    LARGE
  }
  type Rocket {
    id: ID!
    name: String
    type: String
  }
  type Mission {
    name: String
    missionPatch(size: PatchSize): String
  }
  type Launch {
    id: ID!
    site: String
    mission: Mission
    rocket: Rocket
    isBooked: Boolean!
  }
  type User {
    id: ID!
    email: String!
    trips: [Launch]!
    token: String
  }

  type TripUpdateResponse implements BaseResponse {
    success: Boolean!
    message: String
    launches: [Launch]
  }

  type LaunchCollection {
    cursor: String!
    hasMore: Boolean!
    launches: [Launch]!
  }

  type Book {
    name: String
    publish: Date
  }

  input BookQueryInput {
    start: Int
    limit: Int
    name: String
  }

  type Author {
    name: String!
  }

  type AuthorWithBook {
    author: Author!
    # this qurey does not work, but why
    books(query: BookQueryInput): [Book]
  }

  type Query {
    launchesList: [Launch]!
    launches(
      """
      The numebr of results to show. Must be >= 1. Default = 10.
      """
      pageSize: Int

      """
      If you add a cursor here, it will only return results _after_ this cursor
      """
      after: String
    ): LaunchCollection!
    launch(id: ID!): Launch
    me: User
    author(name: String!): Author
    authorWithBook(name: String!): AuthorWithBook
  }

  type Mutation {
    bookTrips(launchIds: [ID]!): TripUpdateResponse!
    cancelTrip(launchId: ID!): TripUpdateResponse!
    login(email: String!): User
  }
`;

module.exports = typeDefs;
