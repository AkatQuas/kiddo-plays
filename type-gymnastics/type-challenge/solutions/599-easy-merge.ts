/*
  599 - Merge
  -------
  by ZYSzys (@ZYSzys) #easy #object

  ### Question

  Merge two types into a new type. Keys of the second type overrides keys of the first type.

  > View on GitHub: https://tsch.js.org/599
*/

/* _____________ Your Code Here _____________ */
type Key = string | number | symbol;

// Determine the key comes from S first
type Merge<F extends Record<Key, unknown>, S extends Record<Key, unknown>> = {
  [P in keyof F | keyof S]: P extends keyof S ? S[P] : F[P];
};

/* _____________ Test Cases _____________ */
import { Equal, Expect } from '@type-challenges/utils';

type Foo = {
  a: number;
  b: string;
};
type Bar = {
  b: number;
  c: boolean;
};

type cases = [
  Expect<
    Equal<
      Merge<Foo, Bar>,
      {
        a: number;
        b: number;
        c: boolean;
      }
    >
  >
];
