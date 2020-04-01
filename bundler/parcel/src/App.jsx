import React, { Fragment } from 'react';
import Counter from './component/counter';

export default () => (
  <Fragment>
    <Counter />
    <Counter init={5} />

  </Fragment>
)