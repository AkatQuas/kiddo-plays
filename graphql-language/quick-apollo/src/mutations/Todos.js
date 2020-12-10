import {
  ApolloClient,
  gql,
  InMemoryCache,
  useMutation,
  useQuery,
} from '@apollo/client';
import React, { Fragment, useRef } from 'react';
import { Errerr, Loading } from '../components';

const client = new ApolloClient({
  uri: 'https://sxewr.sse.codesandbox.io/',
  cache: new InMemoryCache(),
});

const ADD_TODO = gql`
  mutation AddTodo($type: String!) {
    addTodo(type: $type) {
      id
      type
    }
  }
`;

const AddTodo = () => {
  const inputRef = useRef(null);
  const [addTodo] = useMutation(ADD_TODO, {
    client,
    update: (
      /* Apollo Client Cache Instance */ cache,
      /* the object of mutation execution */ { data: { addTodo } }
    ) => {
      /*
        This cache object provides access to cache API methods
        like `readQuery`, `writeQuery`, `readFragment`, `writeFragment` and `modify`.
        These methods enable you to execute GraphQL operations on the cache
        as though you're interacting with a GraphQL server.
       */

      cache.modify({
        fields: {
          todos: (existing = []) => {
            const newTodo = cache.writeFragment({
              data: addTodo,
              fragment: gql`
                fragment NewTodo on Todo {
                  id
                  type
                }
              `,
            });
            return [...existing, newTodo];
          },
        },
      });
    },
  });

  return (
    <div>
      <form
        onSubmit={e => {
          e.preventDefault();
          addTodo({
            variables: {
              type: inputRef.current.value,
            },
          });
          inputRef.current.value = '';
        }}
      >
        <input ref={inputRef} />
        <button type="submit">Add Todo</button>
      </form>
    </div>
  );
};

const UPDATE_TODO = gql`
  mutation UpdateTodo($id: String!, $type: String!) {
    updateTodo(id: $id, type: $type) {
      id
      type
    }
  }
`;

const GET_TODOS = gql`
  query Todos {
    todos {
      id
      type
    }
  }
`;

const TodoItem = ({ todo }) => {
  const [updateTodo, { loading, error }] = useMutation(UPDATE_TODO, { client });

  const { id, type } = todo;
  const inputRef = useRef(null);
  return (
    <li key={id}>
      <p>{type}</p>
      <form
        onSubmit={e => {
          e.preventDefault();
          updateTodo({
            variables: {
              id,
              type: inputRef.current.value,
            },
          });
          inputRef.current.value = '';
        }}
      >
        <input ref={inputRef}></input>
        <button type="submit">Update Todo</button>
      </form>
      {loading && <p>Mutation Loading...</p>}

      {error && (
        <p>
          Mutation Error <Errerr error={error} />
        </p>
      )}
    </li>
  );
};

const TodoList = () => {
  const {
    loading: queryLoading,
    error: queryError,
    data,
    refetch,
  } = useQuery(GET_TODOS, { client });
  if (queryLoading) {
    return <Loading />;
  }

  if (queryError) {
    return <Errerr error={queryError} />;
  }

  return (
    <Fragment>
      <ul>
        {data.todos.map(todo => (
          <TodoItem key={todo.id} todo={todo} />
        ))}
      </ul>
      {typeof refetch === 'function' ? (
        <button onClick={() => refetch()}>Refetch</button>
      ) : null}
    </Fragment>
  );
};

export const Todos = () => {
  return (
    <Fragment>
      <TodoList />
      <AddTodo />
    </Fragment>
  );
};
