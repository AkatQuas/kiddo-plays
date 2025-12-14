/**
 * https://leetcode.com/problems/make-the-string-great/
 */

import { Stack } from './base-types';
type Char =
  | 'a'
  | 'b'
  | 'c'
  | 'd'
  | 'e'
  | 'f'
  | 'g'
  | 'h'
  | 'i'
  | 'j'
  | 'k'
  | 'l'
  | 'm'
  | 'n'
  | 'o'
  | 'p'
  | 'q'
  | 'r'
  | 's'
  | 't'
  | 'u'
  | 'v'
  | 'w'
  | 'x'
  | 'y'
  | 'z'
  | 'A'
  | 'B'
  | 'C'
  | 'D'
  | 'E'
  | 'F'
  | 'G'
  | 'H'
  | 'I'
  | 'J'
  | 'K'
  | 'L'
  | 'M'
  | 'N'
  | 'O'
  | 'P'
  | 'Q'
  | 'R'
  | 'S'
  | 'T'
  | 'U'
  | 'V'
  | 'W'
  | 'X'
  | 'Y'
  | 'Z';

function isLowerAndUpper(a: Char, b: Char) {
  return a.toUpperCase() === b && b.toLowerCase() === a;
}
function isUpperAndLower(a: Char, b: Char) {
  return a.toLowerCase() === b && b.toUpperCase() === a;
}
export function makeGood(s: string): string {
  const stack = new Stack<Char>();
  for (let i = 0, len = s.length; i < len; i++) {
    const el = s[i] as Char;
    const top = stack.peek();

    if (
      top !== null &&
      (isLowerAndUpper(top, el) || isUpperAndLower(top, el))
    ) {
      stack.pop();
    } else {
      stack.push(el);
    }
  }

  let res = '';
  let p = stack.pop();
  while (p !== null) {
    res = p + res;
    p = stack.pop();
  }
  return res;
}
