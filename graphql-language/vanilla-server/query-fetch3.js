import { strictEqual } from 'assert';
import { graphqlFetch } from './utils/fetch.js';

const message = 'This is message I sent';
const queryQuery = `query {
  message
}
`;

const mutateQuery = `mutation ($message: String!) {
  setMessage(message: $message)
}`;

await graphqlFetch({
  query: mutateQuery,
  variables: {
    message,
  },
});

graphqlFetch({
  query: queryQuery,
}).then((r) => {
  strictEqual(r.data.message, message, 'not consistent after mutation');
});
