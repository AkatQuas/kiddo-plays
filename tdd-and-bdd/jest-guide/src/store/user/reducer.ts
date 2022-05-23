import { createSlice } from '@reduxjs/toolkit';
import { FetchUserResponse } from 'apis/user';
import { fetchUserThunk } from 'store/user/thunks';

interface UserState extends FetchUserResponse {
  status: 'loading' | 'complete' | 'error';
}

const initialState: UserState = {
  id: '',
  name: '',
  age: 0,
  role: 'user',
  status: 'loading',
};

const userSlice = createSlice({
  name: 'user',
  initialState,
  reducers: {
    updateUserName: (state, action) => {
      state.name = action.payload.name;
    },
  },
  extraReducers: (builder) => {
    builder.addCase(fetchUserThunk.pending, (state) => {
      state.status = 'loading';
    });
    builder.addCase(fetchUserThunk.fulfilled, (state, action) => {
      state.status = 'complete';
      const { name, id, age, role } = action.payload;
      state.name = name;
      state.id = id;
      state.age = age;
      state.role = role;
    }),
      builder.addCase(fetchUserThunk.rejected, (state) => {
        state.status = 'error';
      });
  },
});

const {
  actions: { updateUserName },
  reducer,
} = userSlice;

export { reducer, updateUserName };
