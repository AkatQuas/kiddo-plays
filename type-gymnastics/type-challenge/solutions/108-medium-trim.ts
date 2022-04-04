/*
  108 - Trim
  -------
  by Anthony Fu (@antfu) #medium #template-literal

  ### Question

  Implement `Trim<T>` which takes an exact string type and returns a new string with the whitespace from both ends removed.

  For example

  ```ts
  type trimed = Trim<'  Hello World  '> // expected to be 'Hello World'
  ```

  > View on GitHub: https://tsch.js.org/108
*/

/* _____________ Your Code Here _____________ */

type SpaceChar = ' ' | '\n' | '\t';
type TrimLeft<S extends string> = S extends `${SpaceChar}${infer R}`
  ? TrimLeft<R>
  : S;
type TrimRight<S extends string> = S extends `${infer R}${SpaceChar}`
  ? TrimRight<R>
  : S;

type Trim<S extends string> = TrimRight<TrimLeft<S>>;

namespace other {
  export type Trim<S extends string> = S extends `${SpaceChar}${infer R}`
    ? Trim<R>
    : S extends `${infer R}${SpaceChar}`
    ? Trim<R>
    : S;
}

/* _____________ Test Cases _____________ */
import { Equal, Expect } from '@type-challenges/utils';

type cases = [
  Expect<Equal<Trim<'str'>, 'str'>>,
  Expect<Equal<Trim<' str'>, 'str'>>,
  Expect<Equal<Trim<'     str'>, 'str'>>,
  Expect<Equal<Trim<'str   '>, 'str'>>,
  Expect<Equal<Trim<'     str     '>, 'str'>>,
  Expect<Equal<Trim<'   \n\t foo bar \t'>, 'foo bar'>>,
  Expect<Equal<other.Trim<'str'>, 'str'>>,
  Expect<Equal<other.Trim<' str'>, 'str'>>,
  Expect<Equal<other.Trim<'     str'>, 'str'>>,
  Expect<Equal<other.Trim<'str   '>, 'str'>>,
  Expect<Equal<other.Trim<'     str     '>, 'str'>>,
  Expect<Equal<other.Trim<'   \n\t foo bar \t'>, 'foo bar'>>
];
