import { createRange } from './lib/generator.mjs';
import { hasher } from './lib/hasher.mjs';

/**
 *
 * @param {string} match
 * @returns
 */
function main(match) {
  const range = createRange(100000, 100000000);

  for (const value of range) {
    if (hasher(value).slice(0, 6) === match) {
      return value;
    }
  }

  return null;
}

console.debug(
  '\x1B[97;42;1m --- found ! --- \x1B[m',
  '\n',
  main(process.argv[2])
);
