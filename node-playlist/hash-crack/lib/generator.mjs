/**
 *
 * @param {number} start
 * @param {number} max
 * @returns
 */
export function* createRange(start, max) {
  let index = start;

  while (index < max) {
    yield index;
    index += 1;
  }
  return max;
}
