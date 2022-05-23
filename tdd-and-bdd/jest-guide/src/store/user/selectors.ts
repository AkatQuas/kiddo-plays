import type { RootState } from '../root';

export const selectUser = (s: RootState) => {
  const { id, age, name, role } = s.user;
  return {
    id,
    age,
    name,
    role,
  };
};

export const selectUserStatus = (s: RootState) => s.user.status;
