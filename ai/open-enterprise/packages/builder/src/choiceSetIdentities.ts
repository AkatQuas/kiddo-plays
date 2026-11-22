import type { LoadedChoiceSet } from "@open-erp/loader";

/**
 * Record only identities and lifecycles that cannot be reused. Do not record labels, default order, or other development metadata.
 * The runtime never reads this artifact. The TypeScript choiceSet declaration remains the only metamodel source of truth.
 */
export interface ChoiceSetIdentityManifest {
  readonly version: 1;
  readonly choiceSets: readonly {
    readonly code: string;
    readonly items: readonly { readonly code: string; readonly retired: boolean }[];
  }[];
}

export function choiceSetIdentityManifest(
  choiceSets: readonly LoadedChoiceSet[],
): ChoiceSetIdentityManifest {
  return {
    version: 1,
    choiceSets: [...choiceSets]
      .sort((left, right) => left.code.localeCompare(right.code))
      .map((choiceSet) => ({
        code: choiceSet.code,
        items: [...choiceSet.items]
          .sort((left, right) => left.code.localeCompare(right.code))
          .map((item) => ({ code: item.code, retired: item.retired })),
      })),
  };
}

/**
 * Upgrade gate: the lifecycle of a published identity is permanently fixed too.
 * A new identity may be appended (including a historical tombstone or reserved identity that is retired on first registration).
 * Deletion, a missing dictionary, active→retired, and retired→active all fail fast. A product-wide disable is not
 * an approved capability. Business enable and disable are maintained only by the tenant overlay.
 */
export function assertChoiceSetIdentityEvolution(
  previous: ChoiceSetIdentityManifest,
  current: ChoiceSetIdentityManifest,
): void {
  if (previous.version !== 1 || current.version !== 1) {
    throw new Error("choiceSet identity manifest version is not supported");
  }
  const currentSets = new Map(current.choiceSets.map((choiceSet) => [choiceSet.code, choiceSet]));
  for (const oldSet of previous.choiceSets) {
    const nextSet = currentSets.get(oldSet.code);
    if (!nextSet) {
      throw new Error(`Product dictionary "${oldSet.code}" cannot be deleted; a published identity must keep being declared in TypeScript`);
    }
    const nextItems = new Map(nextSet.items.map((item) => [item.code, item]));
    for (const oldItem of oldSet.items) {
      const nextItem = nextItems.get(oldItem.code);
      if (!nextItem) {
        throw new Error(
          `Stable code "${oldItem.code}" of product dictionary "${oldSet.code}" cannot be deleted; ` +
            "a published product item must be kept forever, and business enable/disable is maintained by the tenant",
        );
      }
      if (oldItem.retired !== nextItem.retired) {
        const change = oldItem.retired ? "retired → active" : "active → retired";
        throw new Error(
          `Stable code "${oldItem.code}" of product dictionary "${oldSet.code}" cannot change the product lifecycle (${change}); ` +
            "a published product item is kept forever, and business enable/disable is maintained by the tenant",
        );
      }
    }
  }
}

export function renderChoiceSetIdentityManifest(manifest: ChoiceSetIdentityManifest): string {
  return `${JSON.stringify(manifest, null, 2)}\n`;
}
