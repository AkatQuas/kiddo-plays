import { Router } from '@reach/router';
import React, { Fragment } from 'react';
import { Footer, PageContainer } from '../components';
import Cart from './cart';
import Launch from './launch';
import Launches from './launches';
import Profile from './profile';

export default function Pages() {
  return (
    <Fragment>
      <PageContainer>
        <Router primary={false} component={Fragment}>
          <Launches path="/" />
          <Launch path="launch/:launchId" />
          <Cart path="cart" />
          <Profile path="profile" />
        </Router>
      </PageContainer>
      <Footer />
    </Fragment>
  );
}
