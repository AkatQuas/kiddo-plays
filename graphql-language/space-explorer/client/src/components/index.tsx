import { ApolloError } from '@apollo/client';
import React from 'react';

export { default as Button } from './button';
export { default as Footer } from './footer';
export { default as Header } from './header';
export { default as LaunchDetail } from './launch-detail';
export { default as LaunchTile } from './launch-tile';
export { default as Loading } from './loading';
export { default as LoginForm } from './login-form';
export { default as MenuItem } from './menu-item';
export { default as PageContainer } from './page-container';

export const QueryLoading = () => (
  <p>
    <span role="img" aria-label="timing emoji">
      ⏳
    </span>
    Loading...
  </p>
);

export const QueryError: React.FC<{ e: ApolloError | undefined }> = ({ e }) => (
  <p>
    <span role="img" aria-label="error emoji">
      🙅‍♀
    </span>
    ️ Error! {e && e.message}
  </p>
);

export const QueryNoData = () => (
  <p>
    Query with No data.
    <span role="img" aria-label="emptoy data emoji">
      📭
    </span>
  </p>
);

export const QueryLoadingMore = () => (
  <p>
    <span role="img" aria-label="loading more emoji">
      🚛
    </span>
    Loading more...
  </p>
);
