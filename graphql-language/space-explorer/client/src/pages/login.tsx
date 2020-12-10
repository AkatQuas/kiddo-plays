import { gql, useMutation } from '@apollo/client';
import React from 'react';
import { isLoggedInVar } from '../cache';
import { LoginForm, QueryError, QueryLoading } from '../components';
import * as LoginTypes from './__generated__/login';

export const LOGIN_USER = gql`
  mutation Login($email: String!) {
    login(email: $email) {
      id
      token
    }
  }
`;

export default function Login() {
  const [login, { loading, error }] = useMutation<
    LoginTypes.login,
    LoginTypes.loginVariables
  >(LOGIN_USER, {
    onCompleted: ({ login }) => {
      if (login) {
        localStorage.setItem('token', login.token as string);
        localStorage.setItem('userId', login.id as string);
        isLoggedInVar(true);
      }
    },
  });

  if (loading) {
    return <QueryLoading />;
  }
  if (error) {
    return <QueryError e={error} />;
  }
  return <LoginForm login={login} />;
}
