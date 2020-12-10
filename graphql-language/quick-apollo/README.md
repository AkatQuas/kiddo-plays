# Create React App with Apollo Graphql

- [Tutorial apollo](https://www.apollographql.com/docs/react/get-started/) at Tue Dec 8 21:45:48 CST 2020

- [Updating cached query results](https://www.apollographql.com/docs/react/data/queries/#updating-cached-query-results)

- [Updating cached query when mutation executed](https://www.apollographql.com/docs/react/data/mutations/#making-all-other-cache-updates)

## Fragments

- [Fragments](https://www.apollographql.com/docs/react/data/fragments/)

A fragment includes a subset of the fields that are declared for its associated type.

```graphql
fragment NameParts on Person {
  firstName
  lastName
}

query GetPerson {
  peopel(id: $id) {
    ...NameParts
    avatar(size: LARGE)
  }
}
```

```typescript
import { gql } from '@apollo/client';

CommentsPage = {} as any;

CommentsPage.fragments = {
  comment: gql`
    fragment CommentsPageComment on Comment {
      id
      postedBy {
        login
        html_url
      }
      createdAt
      content
    }
  `,
};

const SUBMIT_COMMENT_MUTATION = gql`
  mutation SubmitComment($postFullName: String!, $commentContent: String!) {
    submitComment(
      postFullName: $postFullName
      commentContent: $commentContent
    ) {
      ...CommentsPageComment
    }
  }
  ${CommentsPage.fragments.comment}
  # ⬆ string fragment
`;

export const COMMENT_QUERY = gql`
  query Comment($postName: String!) {
    entry(postFullName: $postName) {
      comments {
        ...CommentsPageComment
      }
    }
  }
  ${CommentsPage.fragments.comment}
  # ⬆ string fragment
`;
```

Using [graphql-tag/loader](https://www.apollographql.com/docs/react/data/fragments/#importing-fragments-when-using-webpack) to include fragments in `.graphql` files.

## Available Scripts

In the project directory, you can run:

### `yarn start`

Runs the app in the development mode.\
Open [http://localhost:3000](http://localhost:3000) to view it in the browser.

The page will reload if you make edits.\
You will also see any lint errors in the console.

### `yarn test`

Launches the test runner in the interactive watch mode.\
See the section about [running tests](https://facebook.github.io/create-react-app/docs/running-tests) for more information.

### `yarn build`

Builds the app for production to the `build` folder.\
It correctly bundles React in production mode and optimizes the build for the best performance.

The build is minified and the filenames include the hashes.\
Your app is ready to be deployed!

See the section about [deployment](https://facebook.github.io/create-react-app/docs/deployment) for more information.

### `yarn eject`

**Note: this is a one-way operation. Once you `eject`, you can’t go back!**

If you aren’t satisfied with the build tool and configuration choices, you can `eject` at any time. This command will remove the single build dependency from your project.

Instead, it will copy all the configuration files and the transitive dependencies (webpack, Babel, ESLint, etc) right into your project so you have full control over them. All of the commands except `eject` will still work, but they will point to the copied scripts so you can tweak them. At this point you’re on your own.

You don’t have to ever use `eject`. The curated feature set is suitable for small and middle deployments, and you shouldn’t feel obligated to use this feature. However we understand that this tool wouldn’t be useful if you couldn’t customize it when you are ready for it.

## Learn More

You can learn more in the [Create React App documentation](https://facebook.github.io/create-react-app/docs/getting-started).

To learn React, check out the [React documentation](https://reactjs.org/).

### Code Splitting

This section has moved here: [https://facebook.github.io/create-react-app/docs/code-splitting](https://facebook.github.io/create-react-app/docs/code-splitting)

### Analyzing the Bundle Size

This section has moved here: [https://facebook.github.io/create-react-app/docs/analyzing-the-bundle-size](https://facebook.github.io/create-react-app/docs/analyzing-the-bundle-size)

### Making a Progressive Web App

This section has moved here: [https://facebook.github.io/create-react-app/docs/making-a-progressive-web-app](https://facebook.github.io/create-react-app/docs/making-a-progressive-web-app)

### Advanced Configuration

This section has moved here: [https://facebook.github.io/create-react-app/docs/advanced-configuration](https://facebook.github.io/create-react-app/docs/advanced-configuration)

### Deployment

This section has moved here: [https://facebook.github.io/create-react-app/docs/deployment](https://facebook.github.io/create-react-app/docs/deployment)

### `yarn build` fails to minify

This section has moved here: [https://facebook.github.io/create-react-app/docs/troubleshooting#npm-run-build-fails-to-minify](https://facebook.github.io/create-react-app/docs/troubleshooting#npm-run-build-fails-to-minify)
