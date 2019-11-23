import React, { useState, Fragment } from 'react';

export default ({ init = 0 }) => {
  const [count, setCount] = useState(init);
  return (
    <Fragment>
      <p>{count}</p>
      <button onClick={() => setCount(count + 1)}>add 1 </button>
    </Fragment>
  )
}