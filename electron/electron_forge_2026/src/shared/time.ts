/**
 * sleep for {@link wait}
 * @param wait milliseconds
 */
export const sleep = (wait = 300) =>
  new Promise((r) => {
    setTimeout(r, wait);
  });
