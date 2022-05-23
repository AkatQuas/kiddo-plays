import { AuthButton } from 'components/auth-button';
import { Title } from 'components/title';
import { User } from 'components/user';
import React from 'react';

export const App = () => {
  return (
    <div>
      <section>
        <Title type="small" title="Small Title" />
        <Title type="large" title="Large Title" />
        <AuthButton>Who are you!</AuthButton>
      </section>
      <section>
        <User></User>
      </section>
    </div>
  );
};
