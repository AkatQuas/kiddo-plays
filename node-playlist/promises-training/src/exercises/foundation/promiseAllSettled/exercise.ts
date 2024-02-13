type Result<T> = Resolved<T> | Rejected;

type Resolved<T> = {
  status: "fulfilled";
  value: T;
};

type Rejected = {
  status: "rejected";
  reason: unknown;
};

export default async <T>(
  promises: Array<Promise<T>>
): Promise<Array<Result<T>>> => {
  const promiseCount = promises.length;
  const promisesResults: Array<Result<T>> = [];
  let finished = 0;

  return new Promise((resolve, _) => {
    promises.forEach((promise, index) => {
      promise.then(
        (value) => {
          promisesResults[index] = {
            status: "fulfilled",
            value,
          };

          finished++;

          if (finished === promiseCount) {
            resolve(promisesResults);
          }
        },
        (reason) => {
          promisesResults[index] = {
            status: "rejected",
            reason,
          };

          finished++;

          if (finished === promiseCount) {
            resolve(promisesResults);
          }
        }
      );
    });
  });
};
