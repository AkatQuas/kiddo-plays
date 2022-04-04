/*
  298 - Length of String
  -------
  by Pig Fang (@g-plane) #medium #template-literal

  ### Question

  Compute the length of a string literal, which behaves like `String#length`.

  > View on GitHub: https://tsch.js.org/298
*/

/* _____________ Your Code Here _____________ */
// It's OK to get length of Array Types;
type GetLength<T extends unknown[]> = T['length'];
type _cases = [
  Expect<Equal<GetLength<[]>, 0>>,
  Expect<Equal<GetLength<['a']>, 1>>,
  Expect<Equal<GetLength<['a', boolean]>, 2>>
];

// So the trick is to convert string into char Array
type LengthOfString<
  S extends string,
  C extends unknown[] = []
> = S extends `${infer F}${infer R}`
  ? LengthOfString<R, [...C, F]>
  : GetLength<C>;

/* _____________ Test Cases _____________ */
import { Equal, Expect } from '@type-challenges/utils';

type cases = [
  Expect<Equal<LengthOfString<''>, 0>>,
  Expect<Equal<LengthOfString<'kumiko'>, 6>>,
  Expect<Equal<LengthOfString<'reina'>, 5>>,
  Expect<Equal<LengthOfString<'Sound! Euphonium'>, 16>>
];
