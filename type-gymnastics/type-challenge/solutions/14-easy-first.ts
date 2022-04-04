/*
  14 - First of Array
  -------
  by Anthony Fu (@antfu) #easy #array

  ### Question

  Implement a generic `First<T>` that takes an Array `T` and returns it's first element's type.

  For example

  ```ts
  type arr1 = ['a', 'b', 'c']
  type arr2 = [3, 2, 1]

  type head1 = First<arr1> // expected to be 'a'
  type head2 = First<arr2> // expected to be 3
  ```

  > View on GitHub: https://tsch.js.org/14
*/

/* _____________ Your Code Here _____________ */

type First<T extends any[]> = T extends [] ? never : T[0];

namespace other {
  export type First<T extends any[]> = T extends [infer F, ...infer R]
    ? F
    : never;
}

/* _____________ Test Cases _____________ */
import { Equal, Expect } from '@type-challenges/utils';

type cases = [
  Expect<Equal<First<[3, 2, 1]>, 3>>,
  Expect<Equal<First<[() => 123, { a: string }]>, () => 123>>,
  Expect<Equal<First<[]>, never>>,
  Expect<Equal<First<[undefined]>, undefined>>,
  Expect<Equal<other.First<[3, 2, 1]>, 3>>,
  Expect<Equal<other.First<[() => 123, { a: string }]>, () => 123>>,
  Expect<Equal<other.First<[]>, never>>,
  Expect<Equal<other.First<[undefined]>, undefined>>
];
