import fetch from 'node-fetch';

export const graphqlFetch = (body, port = 4000) => {
  return fetch(`http://localhost:${port}/graphql`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(body),
  })
    .then((r) => r.json())
    .then(
      (data) => (
        console.log('data returned:', JSON.stringify(data, null, 2)), data
      )
    );
};
