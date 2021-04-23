import { graphqlFetch } from './utils/fetch.js';

const query = `query {
  ip
}
`;

graphqlFetch({
  query,
  variables: {},
});
