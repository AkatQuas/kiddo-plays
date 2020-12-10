import { gql, useQuery } from '@apollo/client';
import { RouteComponentProps } from '@reach/router';
import React, { Fragment } from 'react';
import {
  Header,
  LaunchTile,
  QueryError,
  QueryLoading,
  QueryNoData,
} from '../components';
import { LAUNCH_TILE_DATA } from './launches';
import * as GetMyTripsTypes from './__generated__/GetMyTrips';

export const GET_MY_TRIPS = gql`
  query GetMyTrips {
    me {
      id
      email
      trips {
        ...LaunchTile
      }
    }
  }
  ${LAUNCH_TILE_DATA}
`;

interface TripListProps {}

const TripList: React.FC<TripListProps> = () => {
  const { data, loading, error } = useQuery<GetMyTripsTypes.GetMyTrips>(
    GET_MY_TRIPS,
    {
      fetchPolicy: 'network-only',
    }
  );
  if (loading) {
    return <QueryLoading />;
  }
  if (error) {
    return <QueryError e={error} />;
  }

  if (!data) {
    return <QueryNoData />;
  }

  return (
    <Fragment>
      {data.me?.trips.length ? (
        data.me.trips.map((item: any) => (
          <LaunchTile key={item.id} launch={item} />
        ))
      ) : (
        <p>You haven't booked any trips.</p>
      )}
    </Fragment>
  );
};

interface ProfileProps extends RouteComponentProps {}

const Profile: React.FC<ProfileProps> = () => {
  return (
    <Fragment>
      <Header>My Trips</Header>
      <TripList />
    </Fragment>
  );
};

export default Profile;
