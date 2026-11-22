/**
 * Display-name sidecar for the human-facing HTTP response. The cell still holds
 * the identity (PK / dictionary code). The name lives only in this bag.
 *
 * The agent envelope uses the same resolution. The JSON keys differ (`refLabels` plus module-level `choiceSets`).
 */
export interface PageLabels {
  readonly refs: Readonly<Record<string, Readonly<Record<string, string>>>>;
  readonly refLines: Readonly<Record<string, Readonly<Record<string, string>>>>;
  readonly users: Readonly<Record<string, string>>;
}

export const EMPTY_PAGE_LABELS: PageLabels = { refs: {}, refLines: {}, users: {} };

/** Dictionary bag for GET schema and the agent, at module level. Inline `options` stay out; the source unitSet dictionary that unitChoice resolves to goes in. */
export interface ModuleChoiceSetBag {
  readonly revision: number;
  readonly options: readonly {
    readonly value: string;
    readonly label: string;
    readonly disabled: boolean;
    readonly color?: string;
  }[];
}

export type ModuleChoiceSets = Readonly<Record<string, ModuleChoiceSetBag>>;
