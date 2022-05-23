type AnyFunction = (...args: unknown[]) => unknown;

export const after1000ms = (callback?: AnyFunction) => {
  console.log('Timer start');
  setTimeout(() => {
    console.log('Time is up');
    callback && callback();
  }, 1000);
};
