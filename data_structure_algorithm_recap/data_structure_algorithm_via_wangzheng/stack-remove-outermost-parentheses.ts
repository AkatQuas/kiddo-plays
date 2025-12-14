/**
 * https://leetcode.com/problems/remove-outermost-parentheses/
 */

import { Stack } from './base-types';
type LeftP = '(';
type RightP = ')';
function isLeftP(c: LeftP | RightP): c is LeftP {
  return c === '(';
}

// using stack to find primitive composition
function removeOuterParentheses(s: string): string {
  const pairs: [number, number][] = [];

  const stack = new Stack<LeftP>();
  let start = 0;
  for (let index = 0; index < s.length; index++) {
    const element = s[index] as LeftP | RightP;
    if (isLeftP(element)) {
      stack.push(element);
      continue;
    }
    stack.pop();

    if (stack.isEmpty()) {
      pairs.push([start + 1, index]);
      start = index + 1;
    }
  }

  return pairs.reduce((acc, pair) => {
    return acc + String.prototype.slice.apply(s, pair);
  }, '');
}
