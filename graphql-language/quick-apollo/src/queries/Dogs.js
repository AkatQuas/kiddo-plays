import {
  ApolloClient,
  gql,
  InMemoryCache,
  useLazyQuery,
  useQuery,
} from '@apollo/client';
import React, { Fragment, useCallback, useState } from 'react';
import { Errerr, Loading } from '../components';

const client = new ApolloClient({
  uri: 'https://71z1g.sse.codesandbox.io/',
  cache: new InMemoryCache(),
});

const query = gql`
  query GetDogs {
    dogs {
      id
      breed
    }
  }
`;

const DogsSelection = ({ onDogSelected }) => {
  const { loading, error, data } = useQuery(query, { client });

  if (loading) {
    return <Loading />;
  }

  if (error) {
    return <Errerr error={error} />;
  }

  return (
    <select name="dog" onChange={onDogSelected}>
      <option key="empty-dog-not-possible" value="">
        Please choose
      </option>
      {data.dogs.map(dog => (
        <option key={dog.id} value={dog.breed}>
          {dog.breed}
        </option>
      ))}
    </select>
  );
};
const GET_DOG_PHOTO = gql`
  query Dog($breed: String!) {
    dog(breed: $breed) {
      id
      displayImage
    }
  }
`;

const DogPhoto = ({ breed, pollInterval = 0, tag = null }) => {
  // this is buggy
  const { loading, data, error } = useQuery(GET_DOG_PHOTO, {
    client,
    variables: { breed },
    pollInterval,
    skip: !breed,
  });

  if (!breed || loading) {
    return <Loading />;
  }

  if (error) {
    return <Errerr error={error} />;
  }
  if (tag) {
    console.log(tag, '->', data.dog, pollInterval);
  }
  return (
    <div>
      <img
        src={data.dog.displayImage}
        alt={breed}
        style={{ height: '100px', width: 'auto' }}
      />
    </div>
  );
};

const DogLazyPhoto = ({ breed }) => {
  const [getDog, { loading, data, error, refetch }] = useLazyQuery(
    GET_DOG_PHOTO,
    {
      client,
    }
  );

  if (!breed || loading) {
    return <Loading />;
  }

  if (error) {
    return <Errerr error={error} />;
  }

  return (
    <div>
      {data && data.dog && (
        <img
          src={data.dog.displayImage}
          alt={breed}
          style={{ height: '100px', width: 'auto' }}
        />
      )}
      <button
        onClick={() =>
          // why only work once??
          getDog({
            variables: { breed },
          })
        }
      >
        Click to fetch photo!
      </button>
      {typeof refetch === 'function' ? (
        <button onClick={() => refetch()}>Refetch</button>
      ) : null}
    </div>
  );
};

const DogPhotoRefetch = ({ breed }) => {
  const { loading, data, error, refetch } = useQuery(GET_DOG_PHOTO, {
    client,
    variables: { breed },
    skip: !breed,
  });

  if (!breed || loading) {
    return <Loading />;
  }

  if (error) {
    return <Errerr error={error} />;
  }

  return (
    <div>
      <img
        src={data.dog.displayImage}
        alt={breed}
        style={{ height: '100px', width: 'auto' }}
      />
      <button onClick={() => refetch()}>Refetch!</button>
    </div>
  );
};

export const Dogs = () => {
  const [breed, setBreed] = useState(null);
  const onDogSelected = useCallback(e => {
    setBreed(e.target.value);
  }, []);

  return (
    <Fragment>
      <DogsSelection onDogSelected={onDogSelected} />
      <DogPhoto breed={breed} tag="one" />
      <DogPhoto breed={breed} pollInterval={10000} tag="two" />
      <DogPhotoRefetch breed={breed} />
      <DogLazyPhoto breed={breed} />
    </Fragment>
  );
};
