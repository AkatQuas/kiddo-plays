import { graphqlFetch } from './utils/fetch.js';

const query = `query ($id: String!) {
  ip
  user(id: $id) {
    id
    name
  }
}`;

graphqlFetch(
  {
    query,
    variables: {
      id: 'a',
    },
  },
  4400
);
