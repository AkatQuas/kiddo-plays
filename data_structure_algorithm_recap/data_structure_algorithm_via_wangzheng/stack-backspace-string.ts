/**
 * https://leetcode.com/problems/backspace-string-compare/
 */

import { Stack } from './base-types';

function simplify(s: string) {
  const stack = new Stack<string>();
  for (let i = 0, len = s.length; i < len; i++) {
    const c = s[i];
    if (c !== '#') {
      stack.push(c);
    } else {
      stack.pop();
    }
  }
  let x = '';
  let p = stack.pop();
  while (p) {
    x += p;
    p = stack.pop();
  }
  return x;
}
export function backspaceCompare(s: string, t: string) {
  return simplify(s) === simplify(t);
}
