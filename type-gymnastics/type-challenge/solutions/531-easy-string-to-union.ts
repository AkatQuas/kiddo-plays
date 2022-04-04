/*
  531 - String to Union
  -------
  by Andrey Krasovsky (@bre30kra69cs) #easy #union #string

  ### Question

  Implement the String to Union type. Type take string argument. The output should be a union of input letters

  For example

  ```ts
  type Test = '123';
  type Result = StringToUnion<Test>; // expected to be "1" | "2" | "3"
  ```

  > View on GitHub: https://tsch.js.org/531
*/

/* _____________ Your Code Here _____________ */

type StringToTuple<S extends string> = S extends `${infer F}${infer Rest}`
  ? [F, ...StringToTuple<Rest>]
  : [];

type StringToUnion<T extends string> = StringToTuple<T>[number];

/* _____________ Test Cases _____________ */
import { Equal, Expect } from '@type-challenges/utils';

type cases = [
  Expect<Equal<'l', 'l' | 'l'>>,
  Expect<Equal<StringToUnion<''>, never>>,
  Expect<Equal<StringToUnion<'t'>, 't'>>,
  Expect<Equal<StringToUnion<'hello'>, 'h' | 'e' | 'l' | 'l' | 'o'>>,
  Expect<
    Equal<
      StringToUnion<'coronavirus'>,
      'c' | 'o' | 'r' | 'o' | 'n' | 'a' | 'v' | 'i' | 'r' | 'u' | 's'
    >
  >
];
