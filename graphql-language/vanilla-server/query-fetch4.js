import { strictEqual } from 'assert';
import { graphqlFetch } from './utils/fetch.js';

const author = 'Same Author';
const content = 'This is message I sent';
const updateContent = 'Updated message';

const queryQuery = `query ($id: ID!) {
  getMessage(id: $id) {
    id
    content
    author
  }
}
`;

const createQuery = `mutation ($input: MessageInput!) {
  createMessage(input: $input) {
    id
    content
    author
  }
}`;

const updateQuery = `mutation ($id: ID!, $input: MessageInput) {
  updateMessage(id: $id, input: $input) {
    content
    author
  }
}`;

const createResult = await graphqlFetch({
  query: createQuery,
  variables: {
    input: {
      author,
      content,
    },
  },
});
const getResult = await graphqlFetch({
  query: queryQuery,
  variables: {
    id: createResult.data.createMessage.id,
  },
});

strictEqual(
  getResult.data.getMessage.content,
  content,
  'not consistent after creation'
);

const updateResult = await graphqlFetch({
  query: updateQuery,
  variables: {
    id: getResult.data.getMessage.id,
    input: {
      content: updateContent,
      author,
    },
  },
});

strictEqual(
  updateResult.data.updateMessage.content,
  updateContent,
  'not consistent after modification'
);
