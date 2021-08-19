import * as bcrypt from 'bcrypt';
import * as jwt from 'jsonwebtoken';
import type { Document } from 'mongoose';

// #region Pagination

export interface Pagination {
  limit?: number;
}

export interface PaginationQuery extends Pagination {
  [key: string]: any;
}

// #endregion

// #region Password hashing

const saltSounds = 10;

export const encryptPassword = async (password: string) => {
  return bcrypt.hash(password, saltSounds);
};

export const checkPassword = async (
  plainTextPassword: string,
  hashedPassword: string,
) => {
  return bcrypt.compare(plainTextPassword, hashedPassword);
};

// #endregion

// #region JWT

export interface UserJWT {
  id: string;
  iat: number;
}

export const generateJWT = async (user: Document) => {
  return jwt.sign({ id: user._id }, process.env.JWT_TOKEN);
};

export const validateJWT = async (token?: string) => {
  try {
    return jwt.verify(token, process.env.JWT_TOKEN);
  } catch (error) {
    throw new Error('Session invalid');
  }
};

// #endregion
