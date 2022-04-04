import { Equal, Expect } from '@type-challenges/utils';

type CompilePrefer = 'unknown' | 'local' | 'cloud';

type Thenable<T> = Promise<T>;

type Disposable = never;

type MyCommands = {
  compile: {
    fn: (match?: CompilePrefer) => Thenable<boolean | CompilePrefer>;
    exec:
      | (() => Promise<CompilePrefer>)
      | ((x: CompilePrefer) => Promise<boolean>);
  };
};

declare module hello {
  //#region test

  type NoLast<U, Last = LastInUnion<U>> = Exclude<U, Last>;

  type _1 = [
    Expect<
      Equal<
        UnionToIntersection<{ foo: number } | { bar: string }>,
        { foo: number } & { bar: string }
      >
    >,
    Expect<
      Equal<LastInUnion<{ foo: number } | { bar: string }>, { bar: string }>
    >,
    Expect<
      Equal<LastInUnion<{ bar: number } | { baz: string }>, { baz: string }>
    >,
    Expect<Equal<CheckMatch<() => boolean, []>, boolean>>,
    Expect<Equal<CheckMatch<(q: number) => string, [number]>, string>>,
    Expect<
      Equal<
        CheckMatch<
          (q: number, x: string) => Thenable<string>,
          [number, string]
        >,
        Thenable<string>
      >
    >,
    Expect<Equal<NoLast<never>, never>>,
    Expect<
      Equal<
        NoLast<
          ((x: number) => Promise<boolean>) | (() => Promise<CompilePrefer>)
        >,
        (x: number) => Promise<boolean>
      >
    >,
    Expect<
      Equal<
        NoLast<
          | ((x: string) => number)
          | (() => Promise<CompilePrefer>)
          | ((x: number) => Promise<boolean>)
        >,
        ((x: string) => number) | (() => Promise<CompilePrefer>)
      >
    >
  ];
  //#endregion

  type UnionToIntersection<U> = (
    U extends unknown ? (arg: U) => 0 : never
  ) extends (arg: infer I) => 0
    ? I
    : never;

  type LastInUnion<U> = UnionToIntersection<
    U extends unknown ? (x: U) => 0 : never
  > extends (x: infer L) => 0
    ? L
    : never;
  type IsUnion<T, B = T> = T extends B
    ? [B] extends [T]
      ? false
      : true
    : never;

  /**
   * Check the `Args` match the Parameters of `F`
   * Return the `ReturnType` of `F` if hit
   */
  type CheckMatch<F, Args> = F extends (...args: infer P) => infer R
    ? Args extends P
      ? R
      : never
    : never;

  /**
   * Find matched `Args` in Union,
   *
   * Take out the last one, do some check, failed , so return to FindMatch in rest (rest maybe never | union | single-one )
   */
  type FindMatchInUnion<U, Args, Last = LastInUnion<U>> = CheckMatch<
    Last,
    Args
  > extends never
    ? FindMatch<Exclude<U, Last>, Args>
    : CheckMatch<Last, Args>;

  /**
   * Find matched `Args` in given type `U`
   * `U` maybe is union type, or just single one type
   *
   * So check `IsUnion` first
   */
  type FindMatch<U, Args> = IsUnion<U> extends true
    ? FindMatchInUnion<U, Args>
    : CheckMatch<U, Args>;

  type FindReturn<
    C extends Record<string, { fn: any; exec: any }>,
    K,
    Args extends unknown[]
  > = K extends keyof C ? FindMatch<C[K]['exec'], Args> : never;
  type FindFn<
    C extends Record<string, { fn: any; exec: any }>,
    K
  > = K extends keyof C ? C[K]['fn'] : never;
  namespace commands {
    export function registerCommand<K extends keyof MyCommands>(
      cmd: K,
      fn: FindFn<MyCommands, K>
    ): Disposable;
    export function executeCommand<
      K extends keyof MyCommands,
      T extends unknown[]
    >(cmd: K, ...args: T): FindReturn<MyCommands, K, T>;
  }
}

const y = hello.commands.executeCommand('compile');
// 'local' 无法被提示
// 必须 const 化才能正确拿到值，否则为 never
// 如果想要写 string，就要改掉最上面的 exec 方法定义了
const x = hello.commands.executeCommand('compile', 'local' as const);

type _2 = [
  Expect<Equal<typeof x, Promise<boolean>>>,
  Expect<Equal<typeof y, Promise<CompilePrefer>>>
];
