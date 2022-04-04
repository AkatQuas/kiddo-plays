/*
  16 - Pop
  -------
  by Anthony Fu (@antfu) #medium #array

  ### Question

  > TypeScript 4.0 is recommended in this challenge

  Implement a generic `Pop<T>` that takes an Array `T` and returns an Array without it's last element.

  For example

  ```ts
  type arr1 = ['a', 'b', 'c', 'd']
  type arr2 = [3, 2, 1]

  type re1 = Pop<arr1> // expected to be ['a', 'b', 'c']
  type re2 = Pop<arr2> // expected to be [3, 2]
  ```

  **Extra**: Similarly, can you implement `Shift`, `Push` and `Unshift` as well?

  > View on GitHub: https://tsch.js.org/16
*/

/* _____________ Your Code Here _____________ */

type Pop<T extends any[]> = T extends [...infer M, unknown] ? M : never;
type Push<T extends any[], U> = [...T, U];
type Shift<T extends any[]> = T extends [unknown, ...infer R] ? R : never;
type Unshift<T extends any[], U> = [U, ...T];

/* _____________ Test Cases _____________ */
import { Equal, Expect } from '@type-challenges/utils';

type cases = [
  Expect<Equal<Pop<[3, 2, 1]>, [3, 2]>>,
  Expect<Equal<Pop<['a', 'b', 'c', 'd']>, ['a', 'b', 'c']>>,
  Expect<Equal<Push<[3, 2], 1>, [3, 2, 1]>>,
  Expect<Equal<Push<['a', 'b', 'c'], 'd'>, ['a', 'b', 'c', 'd']>>,
  Expect<Equal<Shift<[3, 2, 1]>, [2, 1]>>,
  Expect<Equal<Shift<['a', 'b', 'c', 'd']>, ['b', 'c', 'd']>>,
  Expect<Equal<Unshift<[3, 2], 1>, [1, 3, 2]>>,
  Expect<Equal<Unshift<['a', 'b', 'c'], 'd'>, ['d', 'a', 'b', 'c']>>
];
