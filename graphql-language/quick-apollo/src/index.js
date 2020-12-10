import { ApolloClient, ApolloProvider, InMemoryCache } from '@apollo/client';
import Tabs, { TabPane } from 'rc-tabs';
import 'rc-tabs/assets/index.css';
import React from 'react';
import ReactDOM from 'react-dom';
import './index.css';
import { Todos } from './mutations/Todos';
import { Dogs } from './queries/Dogs';
import { ExchangeRates } from './queries/ExchangeRates';

const client = new ApolloClient({
  uri: 'https://48p1r2roz4.sse.codesandbox.io',
  cache: new InMemoryCache(),
});

/*
// using in plain js, such redux
client
  .query({
    query: gql`
      query GetRates {
        rates(currency: "USD") {
          currency
          rate
        }
      }
    `,
  })
  .then(result => {
    console.log(result);
  });
*/

ReactDOM.render(
  <React.StrictMode>
    <ApolloProvider client={client}>
      <p>It takes time to loading content, please be patient.</p>
      <Tabs defaultActiveKey="1">
        <TabPane key="1" tab="Todos">
          <Todos />
        </TabPane>
        <TabPane key="2" tab="Dogs">
          <Dogs />
        </TabPane>
        <TabPane key="3" tab="ExchangeRates">
          <ExchangeRates />
        </TabPane>
      </Tabs>
    </ApolloProvider>
  </React.StrictMode>,
  document.getElementById('root')
);
