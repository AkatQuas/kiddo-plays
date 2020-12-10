import { gql, useQuery } from '@apollo/client';
import { RouteComponentProps } from '@reach/router';
import React, { Fragment } from 'react';
import { Header, QueryError, QueryLoading, QueryNoData } from '../components';
import { BookTrips, CartItem } from '../containers';

export const GET_CART_ITEMS = gql`
  query GetCarItems {
    cartItems @client
  }
`;

interface CartListProps extends RouteComponentProps {}

const CartList: React.FC<CartListProps> = () => {
  const { data, loading, error } = useQuery(GET_CART_ITEMS);
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
      {data.cartItems.length === 0 ? (
        <p data-testid="empty-message">No items in the cart.</p>
      ) : (
        <Fragment>
          {data.cartItems.map((launchId: any) => (
            <CartItem key={launchId} launchId={launchId} />
          ))}
          <BookTrips cartItems={data.cartItems || []} />
        </Fragment>
      )}
    </Fragment>
  );
};

interface CartProps extends RouteComponentProps {}

const Cart: React.FC<CartProps> = () => {
  return (
    <Fragment>
      <Header>My Cart</Header>
      <CartList />
    </Fragment>
  );
};

export default Cart;
