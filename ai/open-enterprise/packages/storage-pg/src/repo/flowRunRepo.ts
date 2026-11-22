// ---------------------------------------------------------------------------
// Flow-run result repository — records only "how the last run turned out"
//
// One flow keeps one row, overwritten by code. It answers what color the row of dots on the list should be:
// the last run, which steps went through, and which step it stopped on. Keeping history would mean answering "which run", and one dot
// can express only one answer; to trace back, every real button press is already in the audit log.
//
// What is stored is the executor's own conclusion, not something inferred backwards from document status. The inferred version is always late:
// someone else pushes a document forward by hand, the list turns green, and this flow has never run through once.
// ---------------------------------------------------------------------------

import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { requireIdentity, type Identity } from "@open-erp/runtime-core";
import { flowRun } from "../db/framework.js";
import { scopedValues, scopedWhere } from "../db/scope.js";
import { applyWriteTimeouts, guardConcurrency } from "./pgError.js";
import type { Executor } from "./support.js";

export class FlowRunInputError extends Error {
  override readonly name = "FlowRunInputError";
}

/** Conclusion of one step. `skipped` = this run did not reach it. It does not mean "it was skipped". */
export type FlowRunStepState = "done" | "failed" | "skipped";

export interface FlowRunStep {
  readonly key: string;
  readonly state: FlowRunStepState;
}

export interface StoredFlowRun {
  readonly code: string;
  readonly flowRevision: number;
  readonly steps: readonly FlowRunStep[];
  readonly outcome: "passed" | "blocked";
  readonly ranAt: Date;
  readonly ranBy: string;
}

export interface FlowRunRepo {
  list(identity: Identity): Promise<readonly StoredFlowRun[]>;
  get(identity: Identity, code: string): Promise<StoredFlowRun | null>;
  /** Record once by overwrite. Running the same flow again replaces the previous result. */
  record(
    identity: Identity,
    code: string,
    input: {
      readonly flowRevision: number;
      readonly steps: readonly FlowRunStep[];
      readonly outcome: "passed" | "blocked";
    },
    at: Date,
  ): Promise<StoredFlowRun>;
}

const STATES = new Set<FlowRunStepState>(["done", "failed", "skipped"]);

function toStored(row: {
  code: string;
  flowRevision: number;
  steps: unknown;
  outcome: string;
  ranAt: Date;
  ranBy: string;
}): StoredFlowRun {
  return {
    code: row.code,
    flowRevision: row.flowRevision,
    steps: (Array.isArray(row.steps) ? row.steps : []) as readonly FlowRunStep[],
    outcome: row.outcome === "passed" ? "passed" : "blocked",
    ranAt: row.ranAt,
    ranBy: row.ranBy,
  };
}

export function createFlowRunRepo(exec: Executor): FlowRunRepo {
  return {
    async list(identity) {
      const who = requireIdentity(identity);
      const rows = await exec.select().from(flowRun).where(scopedWhere(flowRun, who));
      return rows.map(toStored);
    },

    async get(identity, code) {
      const who = requireIdentity(identity);
      const rows = await exec
        .select()
        .from(flowRun)
        .where(scopedWhere(flowRun, who, eq(flowRun.code, code)))
        .limit(1);
      const row = rows[0];
      return row ? toStored(row) : null;
    },

    async record(identity, code, input, at) {
      const who = requireIdentity(identity);
      if (!Number.isInteger(input.flowRevision) || input.flowRevision < 0) {
        throw new FlowRunInputError("flowRevision must be a non-negative integer.");
      }
      if (!Array.isArray(input.steps) || input.steps.length === 0) {
        throw new FlowRunInputError("steps must not be empty — if nothing ran, it should not be recorded.");
      }
      for (const step of input.steps) {
        if (typeof step.key !== "string" || step.key === "") {
          throw new FlowRunInputError("Every step must have a key.");
        }
        if (!STATES.has(step.state)) {
          throw new FlowRunInputError(`Step "${step.key}" state must be done / failed / skipped.`);
        }
      }
      if (input.outcome !== "passed" && input.outcome !== "blocked") {
        throw new FlowRunInputError("outcome must be passed / blocked.");
      }
      const steps = input.steps.map((one) => ({ key: one.key, state: one.state }));
      return await guardConcurrency(`record the run result of flow "${code}"`, async () =>
        await exec.transaction(async (tx) => {
          await applyWriteTimeouts(tx);
          const rows = await tx
            .select()
            .from(flowRun)
            .where(scopedWhere(flowRun, who, eq(flowRun.code, code)))
            .for("update")
            .limit(1);
          const values = {
            flowRevision: input.flowRevision,
            steps,
            outcome: input.outcome,
            ranAt: at,
            ranBy: who.userId,
          };
          if (rows[0] === undefined) {
            await tx.insert(flowRun).values(scopedValues(who, { id: randomUUID(), code, ...values }));
          } else {
            await tx.update(flowRun).set(values).where(scopedWhere(flowRun, who, eq(flowRun.code, code)));
          }
          return { code, ...values };
        }),
      );
    },
  };
}
