// ---------------------------------------------------------------------------
// Load `flows/<domain>/*.ts` — business-process declarations organized by verb
//
// ## Why this lives at the top level, not under `domains/<domain>/flows/`
//
// Same rule as `quick-asks/`: the maintainer of this tree is product, not development.
// Everything under `domains/<domain>/` is a module declaration — fields, statuses, edges, gates. Changing a line means understanding the model;
// a flow says "how this factory gets work done". Product and the business edit it against the canvas and do not read module files.
// Mixing them costs product a pass through a layer they should not have to read before they find their own file,
// and in code review the two kinds of change share one diff.
//
// Directories are still split by domain (`flows/sales/`): the domain is the only statement of who owns the flow.
// Laid flat, "is this sales or production" can only be guessed from a prefix inside the code.
//
// Produced by the same scan as `modules/`, but cross-module checks run only after every module is assembled:
// one flow can span several domains (a sales order becoming a production order looks at both salesOrder and productionOrder).
// Validating while scanning would treat the production domain's modules as missing when the sales domain is reached.
//
// ## Two severities land here
//
//   `fatal`  Load fails. A declaration in git points at an edge that does not exist. That can only be a mistake.
//   `gap`    Recorded on `LoadedFlow.problems`. The flow counts as "to be filled in". It does not fail —
//            "I know an edge is missing here; draw the picture through first" is a legitimate product expression. Deleting that step
//            is what actually loses information (after the deletion nobody knows what the system lacks).
//
// ## The declaration is the seed
//
// Same shape as `authorization.ts`: what is loaded here is the product baseline. The version a factory changed on the canvas
// lives in the tenant database, and seeding fills in by code and does not overwrite. This file does not touch the tenant database. It only knows git.
// ---------------------------------------------------------------------------

import { readdirSync, lstatSync } from "node:fs";
import path from "node:path";
import {
  defineComposite,
  isCompositeDraft,
  sealComposite,
  defineFlow,
  isFlowDraft,
  sealFlow,
  validateFlow,
  hasFatal,
  type FlowProblem,
  type CompositeSchema,
  type FlowSchema,
  type ModuleSchema,
} from "@open-erp/metamodel";
import { fail } from "./errors.js";
import { importDefault } from "./filesystem.js";
import { isDirectory, exists } from "./filesystem.js";

export interface LoadedFlow {
  readonly code: string;
  readonly domain: string;
  /** Path relative to `flows/`, so an error can point back at it. */
  readonly file: string;
  readonly schema: FlowSchema;
  /**
   * Gaps left by the cross-module check. An empty array means this flow is sound as declared.
   *
   * `fatal` does not appear here — it already threw at load time. Everything here is a `gap`.
   */
  readonly problems: readonly FlowProblem[];
}

/**
 * Scan domain directories under `flows/`.
 *
 * The directory name is the domain name, and it must be a domain that has been declared: a flow placed in `flows/saels/`
 * (one letter mistyped) quietly becomes a domain nobody owns, and that column on the board stays empty forever.
 */
export function listFlowDomains(flowsRoot: string, known: ReadonlySet<string>): readonly string[] {
  if (!isDirectory(flowsRoot)) return [];
  const out: string[] = [];
  for (const entry of readdirSync(flowsRoot).sort()) {
    if (entry.startsWith("_") || entry.startsWith(".")) continue;
    const full = path.join(flowsRoot, entry);
    if (lstatSync(full).isSymbolicLink()) fail(`flows/${entry} symbolic links are not allowed`);
    if (!isDirectory(full)) {
      // The top level holds only domain directories and notes; .md is for people to read and is not loaded.
      if (entry.endsWith(".md") || entry.endsWith(".json")) continue;
      fail(`flows/${entry} is not a directory — the top level is split into directories by domain (flows/<domain>/<flow>.ts)`);
    }
    if (!known.has(entry)) {
      fail(
        `flows/${entry}/ is not a declared domain — allowed: ${[...known].sort().join(" / ")}. ` +
          `A mistyped domain name puts these flows under a domain nobody owns, and that column on the board stays empty forever`,
      );
    }
    out.push(entry);
  }
  return out;
}

/** Scan flow files under one domain. An empty directory means this domain has declared no flows yet, and that is not an error. */
export function listFlowFiles(flowsDir: string, domain: string): readonly string[] {
  if (!isDirectory(flowsDir)) return [];
  const out: string[] = [];
  for (const entry of readdirSync(flowsDir).sort()) {
    if (entry.startsWith("_") || entry.startsWith(".")) continue;
    const full = path.join(flowsDir, entry);
    if (lstatSync(full).isSymbolicLink()) fail(`flows/${domain}/${entry} symbolic links are not allowed`);
    if (isDirectory(full)) {
      fail(`flows/${domain}/${entry} is a directory — one flow is one file, and there is no directory form`);
    }
    if (entry.endsWith(".d.ts")) continue;
    if (!entry.endsWith(".ts") && !entry.endsWith(".js")) {
      fail(`flows/${domain}/${entry} is not .ts — a domain directory holds only the flow declaration itself`);
    }
    if (!exists(full)) continue;
    out.push(full);
  }
  return out;
}

/** The file name is the code: `order-to-production.ts` → `order-to-production`. */
function codeOfFile(file: string): string {
  return path.basename(file).replace(/\.(ts|js)$/, "");
}

/**
 * Load one flow declaration: inject the identity derived from the path (file name = code, directory name = domain), then check that code is globally unique.
 *
 * The cross-module part is in `validateLoadedFlows`.
 */
export async function loadFlow(
  file: string,
  domain: string,
  flowsRoot: string,
  flows: Map<string, LoadedFlow>,
): Promise<void> {
  const relative = path.relative(flowsRoot, file);
  const raw = await importDefault(file);

  let schema: FlowSchema;
  try {
    // "The export must be the return value of defineFlow()" is enforced by a credential, not by guessing the shape:
    // a credential means the shape gate already ran at import time, so seal directly; no credential means the declaration file can
    // `export default { … }` without calling defineFlow, and the shape gate is bypassed entirely,
    // while it looks completely normal — run the shape gate in place, then seal.
    const draft = isFlowDraft(raw) ? raw : defineFlow(raw, relative);
    schema = sealFlow(draft, { code: codeOfFile(file), domain });
  } catch (cause) {
    fail(`${relative}: ${cause} instanceof Error ? cause.message : String(cause)}`);
  }

  const previous = flows.get(schema.code);
  if (previous) {
    fail(`${relative}: flow code "${schema.code}" is already declared by ${previous.file} — a code is globally unique across the whole product`);
  }

  flows.set(schema.code, { code: schema.code, domain, file: relative, schema, problems: [] });
}

export interface FlowValidateAllInput {
  readonly modules: ReadonlyMap<string, { readonly schema: ModuleSchema }>;
  /** Declared role codes; an empty set skips the role check (when the caller did not provide a catalog, do not pretend it was checked). */
  readonly roles: ReadonlySet<string>;
}

/**
 * After every module is loaded, run the cross-module check and write the gaps back onto each flow.
 *
 * `fatal` calls `fail` directly: the error names the edges that module allows, so a person (and a coding agent)
 * can see which one to write — the error message is the agent's API. If it is unclear, the only option is to guess.
 */
export function validateLoadedFlows(
  flows: Map<string, LoadedFlow>,
  input: FlowValidateAllInput,
): void {
  const modules = new Map<string, ModuleSchema>();
  for (const [code, loaded] of input.modules) modules.set(code, loaded.schema);

  for (const [code, flow] of flows) {
    const problems = validateFlow(flow.schema, { modules, roles: input.roles });
    if (hasFatal(problems)) {
      const lines = problems
        .filter((problem) => problem.severity === "fatal")
        .map((problem) => `  · step "${problem.step ?? "-"}": ${problem.message}`);
      fail(`${flow.file}: flow "${flow.schema.label}" is declared incorrectly\n${lines.join("\n")}`);
    }
    flows.set(code, { ...flow, problems });
  }
}

// ---------------------------------------------------------------------------
// Composite flows — `flows/_composites/*.ts`
//
// They live in a directory whose name starts with `_`, so the domain scan skips it naturally (`listFlowDomains` accepts only domain directories).
// A directory distinguishes them rather than a `kind` field inside the file: it is obvious at a glance that "what is in this directory is not
// a flow", whereas `kind` is known only after opening the file.
// ---------------------------------------------------------------------------

export interface LoadedComposite {
  readonly code: string;
  readonly file: string;
  readonly schema: CompositeSchema;
}

export const COMPOSITES_DIR = "_composites";

export async function loadComposites(
  flowsRoot: string,
  flows: ReadonlyMap<string, LoadedFlow>,
): Promise<readonly LoadedComposite[]> {
  const dir = path.join(flowsRoot, COMPOSITES_DIR);
  if (!isDirectory(dir)) return [];

  const out: LoadedComposite[] = [];
  const seen = new Map<string, string>();
  for (const entry of readdirSync(dir).sort()) {
    if (entry.startsWith(".") || entry.endsWith(".d.ts")) continue;
    if (!entry.endsWith(".ts") && !entry.endsWith(".js")) continue;
    const full = path.join(dir, entry);
    if (lstatSync(full).isSymbolicLink()) fail(`${COMPOSITES_DIR}/${entry} symbolic links are not allowed`);
    const relative = `${COMPOSITES_DIR}/${entry}`;

    const code = entry.replace(/\.(ts|js)$/, "");
    let schema: CompositeSchema;
    try {
      // Same shape as a flow: trust the credential. A declaration file can `export default { … }` and bypass the shape gate,
      // and it looks completely normal; with no credential, run the shape gate once more, then seal.
      const declared = await importDefault(full);
      const draft = isCompositeDraft(declared) ? declared : defineComposite(declared, relative);
      schema = sealComposite(draft, { code });
    } catch (cause) {
      fail(`${relative}: ${cause} instanceof Error ? cause.message : String(cause)}`);
    }
    const previous = seen.get(schema.code);
    if (previous !== undefined) fail(`${relative}: composite flow code "${schema.code}" is already declared by ${previous}`);
    seen.set(schema.code, relative);

    // Every child flow that is referenced must actually exist. When one points at a flow that does not exist, the demo
    // ends suddenly in the middle of a segment, and what is reported is "there is no such flow" — by then nobody remembers
    // who renamed it, or when.
    for (const link of schema.links) {
      if (!flows.has(link.flow)) {
        fail(
          `${relative}: references a flow that does not exist, "${link.flow}" — present: ${[...flows.keys()].sort().join(" / ")}`,
        );
      }
    }
    out.push({ code: schema.code, file: relative, schema });
  }
  return out;
}
