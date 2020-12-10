import { gql, useQuery } from '@apollo/client';
import { RouteComponentProps } from '@reach/router';
import React, { Fragment, useState } from 'react';
import {
  Button,
  Header,
  LaunchTile,
  QueryError,
  QueryLoading,
  QueryLoadingMore,
  QueryNoData,
} from '../components';
import * as GetLaunchListTypes from './__generated__/GetLaunchList';

export const LAUNCH_TILE_DATA = gql`
  fragment LaunchTile on Launch {
    __typename
    id
    isBooked
    rocket {
      id
      name
    }
    mission {
      name
      missionPatch
    }
  }
`;

export const GET_LAUNCHES = gql`
  query GetLaunchList($after: String) {
    launches(after: $after) {
      cursor
      hasMore
      launches {
        ...LaunchTile
      }
    }
  }
  # using fragments ⬇
  ${LAUNCH_TILE_DATA}
`;

interface LaunchListProps extends RouteComponentProps {}

const LaunchList: React.FC<LaunchListProps> = () => {
  const { data, loading, error, fetchMore } = useQuery<
    GetLaunchListTypes.GetLaunchList,
    GetLaunchListTypes.GetLaunchListVariables
  >(GET_LAUNCHES);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
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
      {data.launches?.launches &&
        data.launches.launches
          .filter(Boolean)
          .map((item: any) => <LaunchTile key={item.id} launch={item} />)}

      {data.launches?.hasMore &&
        (isLoadingMore ? (
          <QueryLoadingMore />
        ) : (
          <Button
            onClick={async () => {
              setIsLoadingMore(true);
              await fetchMore({
                variables: {
                  after: data.launches.cursor,
                },
              });
              setIsLoadingMore(false);
            }}
          >
            Load More
          </Button>
        ))}
    </Fragment>
  );
};

interface LaunchesProps extends RouteComponentProps {}

const Launches: React.FC<LaunchesProps> = () => {
  return (
    <Fragment>
      <Header />
      <LaunchList />
    </Fragment>
  );
};

export default Launches;
