/*
  1097 - IsUnion
  -------
  by null (@bencor) #medium

  ### Question

  Implement a type `IsUnion`, which takes an input type `T` and returns whether `T` resolves to a union type.

  For example:

    ```ts
    type case1 = IsUnion<string>  // false
    type case2 = IsUnion<string|number>  // true
    type case3 = IsUnion<[string|number]>  // false
    ```

  > View on GitHub: https://tsch.js.org/1097
*/

/* _____________ Your Code Here _____________ */

// https://www.typescriptlang.org/docs/handbook/2/conditional-types.html#distributive-conditional-types

// 第一个extends其实就是为了利用上述原理将联合类型拆开，这样一来表达式里实际执行的T其实是入参T的子类型，，而B才是T的全类型。
// T如果不是联合类型的话子类型和全类型是一致的，反之则不一致，第二个extends正是利用这个原理来得出结论！（注意它还利用元组阻止了B被拆分～），
// [B] extends [T]成立的话，说明全类型跟子类型是一致的，那就说明最开始的入参T不是联合类型，反过来就说明是🎯。

type IsUnion<T, B = T> = T extends B ? ([B] extends [T] ? false : true) : never;

/* _____________ Test Cases _____________ */
import { Equal, Expect } from '@type-challenges/utils';

type cases = [
  Expect<Equal<IsUnion<string>, false>>,
  Expect<Equal<IsUnion<string | number>, true>>,
  Expect<Equal<IsUnion<'a' | 'b' | 'c' | 'd'>, true>>,
  Expect<Equal<IsUnion<undefined | null | void | ''>, true>>,
  Expect<Equal<IsUnion<{ a: string } | { a: number }>, true>>,
  Expect<Equal<IsUnion<{ a: string | number }>, false>>,
  Expect<Equal<IsUnion<[string | number]>, false>>,
  // Cases where T resolves to a non-union type.
  Expect<Equal<IsUnion<string | never>, false>>,
  Expect<Equal<IsUnion<string | unknown>, false>>,
  Expect<Equal<IsUnion<string | any>, false>>,
  Expect<Equal<IsUnion<string | 'a'>, false>>
];

// AT "2022/02/23 17:24"
// TODO TTDO
// https://www.typescriptlang.org/play#code/PQKgsAUABFCMsGYAMUC0UBKBTADgGwEMBjLAaSwE8BnSGVeh1WqAIwqkEZYjqACgAE8AVzyE2AK0EA7LAEooAYgC2WACYBLQYqjNm8vVACKgrFQAuagPaSd0KAElF+LMsmmoBKKYo4smXIRJyagAaTwALAjcAJ39iXwBrSiooNUkoKUs0rx8qULUAMygqC2VPb18I5MkLN1MwtWTEilCJMyL4tRwoGPxiVIBzYOYAQTKfTwJE5LqY3wIo-s0sVyoAOm1bGxgAMQsoqCwADwJHPCwALi2oAANb0xpbbN8AOQsVLFGAXigAb2YYJ7nKAAcmGwP+UEkJwuRVMUQGEPyhH6QMkmhYWCizAAvlcnlBXu8AEJQb5-WwA8pA4FE8EUlIqVHozGI5FMxQYrG2XGbR7lAlvLAAYVJvwhgJBQrpMBgUOUQLM8Mk-VZBBRkOZXJgPJgeP5hJMooNowAPgLiVAzQahXrxtheiQVAbkt97QEyEkADzO0LAuVYYGWkFItXA0I-f3szmhEPqxUDbEAPigwGAvwloLDkOhUcxMbZsKV-WxQZ+GdpeUZGo5eagsYVcITpYzUtCker0brBfjypLqagAHcLMIVN1YiRs6V8lESoWBp4LB3az13V21XWZ1o0TX9qZFz3+qtbb43XEnTUAKKHBqmIIuvwOj3Ub2C3Ig-1Zn4EAi5qJJlNpmWVIgmCbY5pCWAAG61vWS5-kGBokmaQE+NSraTjC0jQVE+Zqr+fZpkOI5jo+GELhB2HMLc1xXMmABqahYAOUBWFAADiaimAAEoILBAmEpimDgVDnKm9xEGEqxiGsez9MA8DIJAIDAJAqkQKAUAAPraTpuk6VAACaw77EKgpQFxmK+Hp1naVAylqfip6BF6ACqoQACoHIcpjLCoVSakGVAUByFh4IFjbKqEBleT5kh+X4RB7ConpBSFYVmtunLhUWoRSPE1QDpIiahC5Lmii5ybfGVRyxfFpVQAA-LwchAi5ADcamQBpNnWVA7kmG4QoEFQho9XpdkqRAaiOHsbg-FAF4AI6CAQeChFePhEG4JbTrOwJ8E8qASatZzKiYwCCOYeBUHSkD4saorkpSqEgdKGENkWzCwZlLIQDyd36oKJJksw5ZvWoVY-Vqa7qlDkD-RA92CiKIN8i9wJSsw7YHl9BZw39Dn8k5qgPajz0wpmWPgfjMCwTjBMQADdrjiTQOPaDwE0uDkOarjeFzsq8OE8zj7nu8KNimjFOY7Y7Y0zDH0IgzTMvBYzzQqTkvk9SYJ87DvOy9TUG-QjSPq8o1rs1LaFvd9BuykblHK4jgPvPeD1WmznviyrD7umLhquizAemn7Z6IUGxMBzaLvjM6rzm743wJxrgqhynFvIwhQPC74RDDYHUAANrMBtWBbZ6S0rXgnrE3eL5u76H5BsCsafnLmptQrAvFsVYeOs6ibFaXhybaYlfLattcs-XPrvtCn7fvhffx2r0JD0MEAALqdYz6kgFpY36dsghRHUmJQAAyj5wmH0fmkTV14C2Mml8RDEUAUMZRShZdmQiVAASQkRJiSoBJKSMkFjyUQEgYABBJBUAHL9GA9FGLMWKEIcwVgAFAOEqJYA4lJLSVWLJaByBgAYL-tg5gyYACyexfBCgiCIZY-QTD8UEng0B4DiGySUpNSAQA
