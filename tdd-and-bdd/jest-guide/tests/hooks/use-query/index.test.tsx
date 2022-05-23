import { render } from '@testing-library/react';
import { createMemoryHistory, InitialEntry } from 'history';
import { useQuery } from 'hooks/use-query';
import React from 'react';
import { Router } from 'react-router-dom';

const setup = (initialEntries: InitialEntry[]) => {
  const history = createMemoryHistory({
    initialEntries,
  });

  const ret = {
    query: new URLSearchParams(),
  };
  const TestComponent = () => {
    const query = useQuery();
    Object.assign(ret, { query });

    return null;
  };

  render(
    <Router location={history.location} navigator={history}>
      <TestComponent />
    </Router>
  );
  return ret;
};

describe('userQuery', () => {
  it('get query', () => {
    const result = setup([
      {
        pathname: '/home',
        search: 'id=42',
      },
    ]);

    expect(result.query.get('id')).toEqual('42');
  });
  it('get query with null', () => {
    const result = setup([
      {
        pathname: '/home',
        search: 'id=42',
      },
    ]);

    expect(result.query.get('age')).toBeNull();
  });
});
