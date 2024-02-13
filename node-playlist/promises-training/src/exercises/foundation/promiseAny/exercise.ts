export default async <T>(promises: Array<Promise<T>>): Promise<T> => {
  const promiseCount = promises.length;
  const rejectedReasons: Array<unknown> = [];
  let rejected = 0;

  return new Promise((resolve, reject) => {
    promises.forEach((promise, index) => {
      promise.then(resolve, (err: unknown) => {
        rejectedReasons[index] = err;
        rejected += 1;
        if (promiseCount === rejected) {
          reject(rejectedReasons);
        }
      });
    });
  });
};
