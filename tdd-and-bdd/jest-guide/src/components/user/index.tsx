import { Button } from 'antd';
import React, { useCallback } from 'react';
import { useAppDispatch, useAppSelector } from 'store/root';
import { selectUser, selectUserStatus } from 'store/user/selectors';
import { fetchUserThunk } from 'store/user/thunks';

export const User = ({}) => {
  const dispatch = useAppDispatch();

  const user = useAppSelector(selectUser);
  const status = useAppSelector(selectUserStatus);

  const handleClick = useCallback(async () => {
    await dispatch(fetchUserThunk());
  }, [dispatch]);
  return (
    <div>
      <h2>User Info</h2>
      {status === 'loading' ? <p>Loading...</p> : null}
      {user.id ? (
        <div>
          <p>ID: {user.id}</p>
          <p>Name: {user.name}</p>
          <p>Age: {user.age}</p>
        </div>
      ) : (
        <p>No information</p>
      )}

      <Button onClick={handleClick} type="primary">
        Load User
      </Button>
    </div>
  );
};
