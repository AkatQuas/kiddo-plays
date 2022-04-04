/*
  612 - KebabCase
  -------
  by Johnson Chu (@johnsoncodehk) #easy #template-literal

  ### Question

  `FooBarBaz` -> `foo-bar-baz`

  > View on GitHub: https://tsch.js.org/612
*/

/* _____________ Your Code Here _____________ */

type KebabCase<
  S extends string,
  B extends boolean = true,
  R extends string = ''
> = S extends `${infer First}${infer Rest}`
  ? KebabCase<
      Rest,
      false,
      B extends true
        ? Lowercase<First>
        : Lowercase<First> extends First
        ? `${R}${First}`
        : `${R}-${Lowercase<First>}`
    >
  : R;

// equivalent function
function kebabCase(
  input: string,
  first: boolean = true,
  leading: string = ''
): string {
  const firstChar = input[0];
  const rest = input.slice(1);

  if (firstChar) {
    return kebabCase(
      rest,
      false,
      first
        ? firstChar.toLowerCase()
        : firstChar === firstChar.toLowerCase()
        ? leading + firstChar
        : leading + '-' + firstChar.toLowerCase()
    );
  }

  return leading;
}

// equivalent function 2
function kebab(done: string, first: boolean, toDeal: string): string {
  const firstChar = toDeal[0];
  const rest = toDeal.slice(1);
  if (firstChar) {
    return kebab(
      first
        ? firstChar.toLowerCase()
        : firstChar === firstChar.toLowerCase()
        ? done + firstChar
        : done + '-' + firstChar.toLowerCase(),
      false,
      rest
    );
  }
  return done;
}

// console.log(kebabCase('FooBarBaz') === 'foo-bar-baz');
// console.log(kebab('', true,'FooBarBaz') === 'foo-bar-baz');

/* _____________ Test Cases _____________ */
import { Equal, Expect } from '@type-challenges/utils';

type cases = [
  Expect<Equal<KebabCase<'FooBarBaz'>, 'foo-bar-baz'>>,
  Expect<Equal<KebabCase<'fooBarBaz'>, 'foo-bar-baz'>>,
  Expect<Equal<KebabCase<'foo-bar'>, 'foo-bar'>>,
  Expect<Equal<KebabCase<'foo_bar'>, 'foo_bar'>>,
  Expect<Equal<KebabCase<'Foo-Bar'>, 'foo--bar'>>,
  Expect<Equal<KebabCase<'ABC'>, 'a-b-c'>>,
  Expect<Equal<KebabCase<'-'>, '-'>>,
  Expect<Equal<KebabCase<''>, ''>>,
  Expect<Equal<KebabCase<'😎'>, '😎'>>
];
