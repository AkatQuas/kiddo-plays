/*
  527 - Append to object
  -------
  by Andrey Krasovsky (@bre30kra69cs) #medium #object-keys

  ### Question

  Implement a type that adds a new field to the interface. The type takes the three arguments. The output should be an object with the new field.

  For example

  ```ts
  type Test = { id: '1' }
  type Result = AppendToObject<Test, 'value', 4> // expected to be { id: '1', value: 4 }
  ```

  > View on GitHub: https://tsch.js.org/527
*/

/* _____________ Your Code Here _____________ */

type Key = string | symbol | number;

type AppendToObject<T extends Record<Key, any>, U extends Key, V> = {
  [K in keyof T | U]: K extends U ? V : T[K];
};

namespace bad {
  export type AppendToObject<
    T extends Record<Key, any>,
    U extends Key,
    V
  > = T & { [P in U]: V };
}

/* _____________ Test Cases _____________ */
import { Expect } from '@type-challenges/utils';

// See the explanation https://github.com/microsoft/TypeScript/issues/27024
// And https://stackoverflow.com/a/68963796

type Equal<T, S> = [T] extends [S] ? ([S] extends [T] ? true : false) : false;

type test1 = {
  key: 'cat';
  value: 'green';
};

type testExpect1 = {
  key: 'cat';
  value: 'green';
  home: boolean;
};

type test2 = {
  key: 'dog' | undefined;
  value: 'white';
  sun: true;
};

type testExpect2 = {
  key: 'dog' | undefined;
  value: 'white';
  sun: true;
  home: 1;
};

type test3 = {
  key: 'cow';
  value: 'yellow';
  sun: false;
};

type testExpect3 = {
  key: 'cow';
  value: 'yellow';
  sun: false;
  isMotherRussia: false | undefined;
};

type cases = [
  Expect<Equal<AppendToObject<test1, 'home', boolean>, testExpect1>>,
  Expect<Equal<AppendToObject<test2, 'home', 1>, testExpect2>>,
  Expect<
    Equal<
      AppendToObject<test3, 'isMotherRussia', false | undefined>,
      testExpect3
    >
  >,
  Expect<Equal<bad.AppendToObject<test1, 'home', boolean>, testExpect1>>,
  Expect<Equal<bad.AppendToObject<test2, 'home', 1>, testExpect2>>,
  Expect<
    Equal<
      bad.AppendToObject<test3, 'isMotherRussia', false | undefined>,
      testExpect3
    >
  >
];
