import { gql, useQuery } from '@apollo/client';
import React from 'react';
import { Errerr, Loading } from '../components';

const query = gql`
  query GetExchangeRates {
    rates(currency: "USD") {
      currency
      rate
    }
  }
`;

export const ExchangeRates = () => {
  const { loading, error, data } = useQuery(query);

  if (loading) {
    return <Loading />;
  }

  if (error) {
    return <Errerr error={error} />;
  }

  return data.rates.map(({ currency, rate }) => (
    <div key={currency}>
      <p>
        💰{currency}: {rate}
      </p>
    </div>
  ));
};
