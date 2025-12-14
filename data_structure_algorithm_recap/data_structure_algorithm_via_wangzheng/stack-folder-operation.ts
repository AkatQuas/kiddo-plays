/**
 * https://leetcode.com/problems/crawler-log-folder/
 */

import { Stack } from './base-types';

type Op = '../' | './' | `${string}${number}/`;

function minOperations(logs: string[]): number {
  const stack = new Stack<Op>();
  for (let i = 0, len = logs.length; i < len; i++) {
    const el = logs[i] as Op;
    if (el === './') {
      continue;
    }

    if (el === '../') {
      if (stack.isEmpty()) {
        continue;
      }

      stack.pop();
    } else {
      stack.push(el);
    }
  }

  return stack.stack.length;
}
