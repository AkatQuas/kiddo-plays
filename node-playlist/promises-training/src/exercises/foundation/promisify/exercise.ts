type FunctionWithCallback<T, Args extends Array<unknown>> = (
  ...params: [...Args, Callback<T>]
) => void;

type Callback<T> = (err: unknown, data: T) => void;

type PromisifiedFunction<T, Args extends Array<unknown>> = (
  ...args: Args
) => Promise<T>;

export default <T, Args extends Array<unknown>>(
    fn: FunctionWithCallback<T, Args>
  ): PromisifiedFunction<T, Args> =>
  (...args) => {
    return new Promise((resolve, reject) => {
      fn(...args, (err: unknown, data: T): void => {
        if (err) {
          reject(err);
          return;
        }
        resolve(data);
      });
    });
  };
