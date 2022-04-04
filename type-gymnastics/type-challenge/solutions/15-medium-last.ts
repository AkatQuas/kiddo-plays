/*
  15 - Last of Array
  -------
  by Anthony Fu (@antfu) #medium #array

  ### Question

  > TypeScript 4.0 is recommended in this challenge

  Implement a generic `Last<T>` that takes an Array `T` and returns its last element.

  For example

  ```ts
  type arr1 = ['a', 'b', 'c']
  type arr2 = [3, 2, 1]

  type tail1 = Last<arr1> // expected to be 'c'
  type tail2 = Last<arr2> // expected to be 1
  ```

  > View on GitHub: https://tsch.js.org/15
*/

/* _____________ Your Code Here _____________ */

type Last<T extends unknown[]> = T extends []
  ? never
  : T extends [infer R]
  ? R
  : T extends [unknown, ...infer M]
  ? Last<M>
  : never;

namespace other {
  export type Last<T extends unknown[]> = T extends [
    ...other: infer ANY,
    last: infer R
  ]
    ? R
    : never;

  export type Last2<T extends unknown[]> = [never, ...T][T['length']];
}

/* _____________ Test Cases _____________ */
import { Equal, Expect } from '@type-challenges/utils';

type cases = [
  Expect<Equal<Last<[3, 2, 1]>, 1>>,
  Expect<Equal<Last<[() => 123, { a: string }]>, { a: string }>>,
  Expect<Equal<other.Last<[3, 2, 1]>, 1>>,
  Expect<Equal<other.Last<[() => 123, { a: string }]>, { a: string }>>,
  Expect<Equal<other.Last2<[3, 2, 1]>, 1>>,
  Expect<Equal<other.Last2<[() => 123, { a: string }]>, { a: string }>>
];
