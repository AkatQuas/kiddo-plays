import { createHash } from 'node:crypto';

export const hasher = (/** @type {number} */ value) => {
  return createHash('md5').update(`${value}`).digest('hex');
};
