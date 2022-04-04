/*
  62 - Type Lookup
  -------
  by Anthony Fu (@antfu) #medium #union #map

  ### Question

  Sometimes, you may want to lookup for a type in a union to by their attributes.

  In this challenge, we would like to get the corresponding type by searching for the common `type` field in the union `Cat | Dog`. In other words, we will expect to get `Dog` for `LookUp<Dog | Cat, 'dog'>` and `Cat` for `LookUp<Dog | Cat, 'cat'>` in the following example.

  ```ts
  interface Cat {
    type: 'cat'
    breeds: 'Abyssinian' | 'Shorthair' | 'Curl' | 'Bengal'
  }

  interface Dog {
    type: 'dog'
    breeds: 'Hound' | 'Brittany' | 'Bulldog' | 'Boxer'
    color: 'brown' | 'white' | 'black'
  }

  type MyDogType = LookUp<Cat | Dog, 'dog'> // expected to be `Dog`
  ```

  > View on GitHub: https://tsch.js.org/62
*/

/* _____________ Your Code Here _____________ */

type LookUp<U, T> = U extends {
  type: T;
}
  ? U
  : never;

namespace other {
  export type LookUp<U, T> = U extends { type: infer R }
    ? R extends T
      ? U
      : never
    : never;
}

/* _____________ Test Cases _____________ */
import { Equal, Expect } from '@type-challenges/utils';

interface Cat {
  type: 'cat';
  breeds: 'Abyssinian' | 'Shorthair' | 'Curl' | 'Bengal';
}

interface Dog {
  type: 'dog';
  breeds: 'Hound' | 'Brittany' | 'Bulldog' | 'Boxer';
  color: 'brown' | 'white' | 'black';
}
interface Dogger {
  type: 'dog';
  breeds: 'dogger';
}

type Animal = Cat | Dog | Dogger;
// @show-types
type A = LookUp<Animal, 'dog'>;
type cases = [
  Expect<Equal<LookUp<Animal, 'dog'>, Dog | Dogger>>,
  Expect<Equal<LookUp<Animal, 'cat'>, Cat>>,
  Expect<Equal<other.LookUp<Animal, 'dog'>, Dog | Dogger>>,
  Expect<Equal<other.LookUp<Animal, 'cat'>, Cat>>
];
