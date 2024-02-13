export default async <T>(promises: Array<Promise<T>>): Promise<Array<T>> => {
  const promiseCount = promises.length;
  const resolvedValues: Array<T> = [];
  let resolved = 0;

  return new Promise((resolve, reject) => {
    promises.forEach((promise, index) => {
      promise.then((value) => {
        resolvedValues[index] = value;
        resolved += 1;
        if (resolved === promiseCount) {
          resolve(resolvedValues);
        }
      }, reject);
    });
  });
};
