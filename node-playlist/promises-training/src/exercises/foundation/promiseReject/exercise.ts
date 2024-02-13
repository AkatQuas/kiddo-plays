export default async <T>(reason: T): Promise<T> => {
  return Promise.reject(reason);
};
