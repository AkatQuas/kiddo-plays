export default async <T>(value: T): Promise<T> => {
  return Promise.resolve(value);
};
