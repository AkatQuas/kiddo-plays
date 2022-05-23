import { createAsyncThunk } from '@reduxjs/toolkit';
import { fetchUser } from 'apis/user';

export const fetchUserThunk = createAsyncThunk(
  'user/fetchUserThunk',
  async () => {
    return await fetchUser();
  }
);
