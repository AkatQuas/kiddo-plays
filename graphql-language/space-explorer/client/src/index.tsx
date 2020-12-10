import {
  ApolloClient,
  ApolloProvider,
  gql,
  NormalizedCacheObject,
  useQuery,
} from '@apollo/client';
import React from 'react';
import ReactDOM from 'react-dom';
import { cache } from './cache';
import Pages from './pages';
import Login from './pages/login';
import injectStyles from './styles';

injectStyles();

/**
 * client-side Graphql Schema
 */
export const typeDefs = gql`
  # extend a GraphQL type that's defined in another
  # location to add fields to that type.
  extend type Query {
    isLoggedIn: Boolean! # track whether the user has an active session
    cartItems: [ID!]! # track which launches the user has added to their cart
  }
`;

const client: ApolloClient<NormalizedCacheObject> = new ApolloClient({
  cache,
  uri: 'http://localhost:4000/graphql',
  headers: {
    authorization: localStorage.getItem('token') || '',
  },
  typeDefs,
});

/**
 * Directly usage
 */
client.query({
  query: gql`
    query TestQuery {
      launch(id: 56) {
        id
        mission {
          name
        }
      }
    }
  `,
});

const IS_LOGGED_IN = gql`
  query IsUserLoggedIn {
    isLoggedIn @client
  }
`;

const IsLoggedIn = () => {
  const { data } = useQuery(IS_LOGGED_IN);
  return data.isLoggedIn ? <Pages /> : <Login />;
};

ReactDOM.render(
  <ApolloProvider client={client}>
    <IsLoggedIn />
  </ApolloProvider>,
  document.getElementById('root')
);
