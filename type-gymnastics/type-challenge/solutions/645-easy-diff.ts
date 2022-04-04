/*
  645 - Diff
  -------
  by ZYSzys (@ZYSzys) #easy #object

  ### Question

  Get an `Object` that is the difference between `O` & `O1`

  > View on GitHub: https://tsch.js.org/645
*/

/* _____________ Your Code Here _____________ */

type Diff<T, J> = {
  [K in
    | Exclude<keyof T, keyof J>
    | Exclude<keyof J, keyof T>]: K extends keyof T
    ? T[K]
    : K extends keyof J
    ? J[K]
    : never;
};

/* _____________ Test Cases _____________ */
import { Equal, Expect } from '@type-challenges/utils';

type Foo = {
  name: string;
  age: string;
  category: boolean;
};
type Bar = {
  name: string;
  age: string;
  gender: number;
};

type cases = [
  Expect<Equal<Diff<Foo, Bar>, { gender: number; category: boolean }>>,
  Expect<Equal<Diff<Bar, Foo>, { gender: number; category: boolean }>>
];
