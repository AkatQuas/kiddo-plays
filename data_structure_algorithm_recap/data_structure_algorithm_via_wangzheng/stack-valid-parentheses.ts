/**
 * https://leetcode.com/problems/valid-parentheses/
 */

import { Stack } from './base-types';

type LeftParentheses = '{' | '(' | '[';
type RightParentheses = ']' | ')' | '}';
const mapping = {
  '}': '{',
  ')': '{',
  ']': '[',
} as const;

function isLeft(el: string): el is LeftParentheses {
  return el === '(' || el === '[' || el === '{';
}
export function isValid(s: string): boolean {
  const stack = new Stack<LeftParentheses>();

  for (let index = 0; index < s.length; index++) {
    const el = s[index] as LeftParentheses | RightParentheses;
    if (isLeft(el)) {
      stack.push(el);
      continue;
    }

    const patch = stack.pop();
    if (patch !== mapping[el]) {
      return false;
    }
  }
  return stack.isEmpty();
}
