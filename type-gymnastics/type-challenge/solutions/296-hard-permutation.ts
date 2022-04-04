/*
  296 - Permutation
  -------
  by Naoto Ikuno (@pandanoir) #hard #union

  ### Question

  Implement permutation type that transforms union types into the array that includes permutations of unions.

  ```typescript
  type perm = Permutation<'A' | 'B' | 'C'>; // ['A', 'B', 'C'] | ['A', 'C', 'B'] | ['B', 'A', 'C'] | ['B', 'C', 'A'] | ['C', 'A', 'B'] | ['C', 'B', 'A']
  ```

  > View on GitHub: https://tsch.js.org/296
*/

// how to loop union:
type loopUnion<Union extends string> = Union extends Union
  ? `loop ${Union}`
  : never;
type loop_case = [
  Expect<Equal<loopUnion<'A' | 'B' | 'C'>, 'loop A' | 'loop B' | 'loop C'>>
];

// how to check "T is never"
type IsNever<T> = [T] extends [never] ? true : false;
type never_case = [
  Expect<Equal<IsNever<'A' | 'B' | 'C'>, false>>,
  Expect<Equal<IsNever<never>, true>>,
  Expect<Equal<IsNever<unknown>, false>>,
  Expect<Equal<IsNever<null>, false>>,
  Expect<Equal<IsNever<undefined>, false>>
];

/* _____________ Your Code Here _____________ */

type Permutation<Union, Item = Union> = [Union] extends [never]
  ? []
  : Item extends Union
  ? [Item, ...Permutation<Exclude<Union, Item>>]
  : [];

/* _____________ Test Cases _____________ */
import { Equal, Expect } from '@type-challenges/utils';

type cases = [
  Expect<Equal<Permutation<'A'>, ['A']>>,
  Expect<
    Equal<
      Permutation<'A' | 'B' | 'C'>,
      | ['A', 'B', 'C']
      | ['A', 'C', 'B']
      | ['B', 'A', 'C']
      | ['B', 'C', 'A']
      | ['C', 'A', 'B']
      | ['C', 'B', 'A']
    >
  >,
  Expect<
    Equal<
      Permutation<'B' | 'A' | 'C'>,
      | ['A', 'B', 'C']
      | ['A', 'C', 'B']
      | ['B', 'A', 'C']
      | ['B', 'C', 'A']
      | ['C', 'A', 'B']
      | ['C', 'B', 'A']
    >
  >,
  Expect<Equal<Permutation<never>, []>>
];

/**
 * Refer to this https://github.com/type-challenges/type-challenges/issues/614 for more details.
 */
