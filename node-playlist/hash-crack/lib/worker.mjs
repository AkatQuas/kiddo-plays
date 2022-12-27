import { BroadcastChannel, workerData } from 'node:worker_threads';
import { createRange } from './generator.mjs';
import { hasher } from './hasher.mjs';

/**
 * @param {number} value
 * @param {string} match
 * @returns {boolean}
 */
const check = (value, match) => {
  return hasher(value).slice(0, 6) === match;
};

const bc = new BroadcastChannel('job');

const { START, MAX, match, index, total } = workerData;
const step = Math.floor((MAX - START) / total);

const range = createRange(START + step * index, START + step * (index + 1) + 1);

for (const value of range) {
  if (check(value, match)) {
    bc.postMessage(value);
    bc.close();
  }
}
