import axios from 'axios';
export type UserRole = 'user' | 'admin';

export interface FetchUserRoleResponse {
  role: UserRole;
}

export const fetchUserRole = async (): Promise<FetchUserRoleResponse> => {
  const { data } = await axios.get<FetchUserRoleResponse>(
    'https://any-site.com/api/role'
  );
  return data;
};

export interface FetchUserResponse extends FetchUserRoleResponse {
  id: string;
  name: string;
  age: number;
}

export const fetchUser = async (): Promise<FetchUserResponse> => {
  const { data } = await axios.get<FetchUserResponse>(
    'https://any-site.com/api/info'
  );
  return data;
};
