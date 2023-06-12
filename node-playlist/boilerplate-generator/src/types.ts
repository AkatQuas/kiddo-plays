import {
  checkbox,
  confirm,
  editor,
  input,
  password,
  select,
} from '@inquirer/prompts';
import { TupleToUnion } from 'type-fest';

export type SupportPrompt =
  | 'checkbox'
  | 'confirm'
  | 'editor'
  | 'input'
  | 'password'
  | 'select';

export interface GenerateOptions {
  output: string;
  template?: string;
  templates?: string;
  force?: boolean;
}

type TupleToTuple<T extends unknown[], R extends unknown[] = []> = T extends [
  infer H,
  ...infer N
]
  ? H extends (...arg: any) => any
    ? TupleToTuple<
        N,
        [
          ...R,
          Parameters<H>[0] & {
            /** Optional, default to "input" */ _type: SupportPrompt;
          }
        ]
      >
    : TupleToTuple<N, R>
  : R;

type _Options = TupleToTuple<
  [
    typeof checkbox,
    typeof confirm,
    typeof editor,
    typeof input,
    typeof password,
    typeof select
  ]
>;

type PromptOptions = TupleToUnion<_Options>;

export interface IMeta {
  /** dynamic metadata */
  inputs: Record<string, PromptOptions>;

  /** boilerplate name, use directory name if unset */
  name?: string;

  /** static metadata */
  metadata?: Record<string, unknown>;
}

export interface Meta extends IMeta {
  name: string;
  /** Absolute path to template directory */
  dir: string;
}
