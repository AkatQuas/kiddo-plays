/**
 * https://leetcode.com/problems/maximum-nesting-depth-of-the-parentheses/
 */

import { Stack } from './base-types';

type Char =
  | '0'
  | '1'
  | '2'
  | '3'
  | '4'
  | '5'
  | '6'
  | '7'
  | '8'
  | '9'
  | '+'
  | '-'
  | '*'
  | '/'
  | '('
  | ')';
function maxDepth(s: string): number {
  const stack = new Stack<'('>();
  let depth = 0;
  for (let i = 0, len = s.length; i < len; i++) {
    const el = s[i] as Char;
    if (el === '(') {
      stack.push(el);
    } else if (el === ')') {
      const s = stack.stack.length;
      if (s > depth) {
        depth = s;
      }
      stack.pop();
    }
  }
  return depth;
}
