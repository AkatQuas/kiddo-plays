/**
 * https://leetcode.com/problems/baseball-game/
 */

import { Stack } from './base-types';

function calPoints(ops: string[]): number {
  const stack = new Stack<number>();
  for (let i = 0, len = ops.length; i < len; i++) {
    const el = ops[i];
    if (el === '+') {
      const n1 = stack.pop()!;
      const n2 = stack.peek()!;
      stack.push(n1);
      stack.push(n1 + n2);
    } else if (el === 'D') {
      const n = stack.peek()!;
      stack.push(n * 2);
    } else if (el === 'C') {
      stack.pop();
    } else {
      stack.push(parseInt(el));
    }
  }

  let x = 0;
  let p = stack.pop();
  while (typeof p === 'number') {
    x = x + p;
    p = stack.pop();
  }
  return x;
}
