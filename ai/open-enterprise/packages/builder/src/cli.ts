#!/usr/bin/env node
// ---------------------------------------------------------------------------
// open-erp CLI shell — parse arguments and serialize output. The logic lives in index.ts / catalog.ts
//
// Only three commands remain. The criterion is "can this still be done correctly without the command":
//   - `catalog`: the static contract for a coding agent. It emits derived state (gates inherited by a route exit,
//     the reverse side of postsToLedger, incoming-edge lookup, creatability, supplied values, candidate filters, uniqueness)
//     and coordinates (module code, file path, field key, edge code). Derived state is not written in the module source,
//     so reading the source gets it systematically wrong. Coordinates are the entry that sends the agent to the source.
//   - `gen:db`: the compile step from declaration to table definition. It cannot be skipped.
//   - `gen:choice-set-identities`: upgrade-check the committed identity artifact, then write new identities.
//     A hand-edited JSON cannot prove that no code was deleted and no tombstone was revived before the write.
//
// list / validate / check / request used to exist and were removed:
//   - `list` = `ls domains/*/modules/`
//   - `validate` / `check` are gates. A gate cannot depend on someone remembering to run it. They are in `yarn test`
//     (`test/gate.test.ts`). Red means red.
//   - `request` had no path back upstream: the file lived on the customer branch, and upstream never saw it.
//     Whether a change to `packages/` is countable is the diff against upstream, not a form nobody reads.
//
// `catalog` always emits JSON. There is no `--json`, no color, and no layout. There used to be an
// ANSI, Chinese-aligned, section-titled rendering for people. The audience of these commands is a coding agent,
// and the first thing it does with color codes is strip them. Two renderings also drift — one fact, two wordings —
// and nothing reports the drift.
// ---------------------------------------------------------------------------

import { existsSync, mkdirSync, readFileSync, readdirSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { loadCatalog } from "@open-erp/loader";
import { genDb, GENERATED_BANNER } from "./codegen.js";
import { genAnalysisCatalog } from "./analysisCatalogGen.js";
import { genHatches } from "./hatchesGen.js";
import {
  assertChoiceSetIdentityEvolution,
  catalog,
  choiceSetIdentityManifest,
  renderChoiceSetIdentityManifest,
  type CatalogSelector,
  type ChoiceSetIdentityManifest,
} from "./index.js";

/**
 * Output sink. It exists so `--json` and human text can be tested for consistency.
 *
 * Writing `process.stdout` directly leaves "spawn a process and capture stdout" as the only way to check the two renderings,
 * and that requires a build first. The assertion would never be written, and the two outputs could drift with no symptom.
 */
export interface Sink {
  write(text: string): void;
}

const USAGE = `open-erp — Open Enterprise modeling tool

Usage (normally invoked through the root scripts; this layer does not need to be memorized):
  yarn catalog                     repo level: domains + module index
  yarn catalog --module <module>   full contract for one module: fields, statuses, edges, gates, postings, incoming-edge lookup
  yarn catalog --domain <domain>   repo-level index limited to one domain
  yarn catalog --around <module>   one-hop dependencies: neighboring modules, create-bill flow, and field-level bindings
  yarn catalog --need <feature>    filter modules by capability; comma-separated or repeated. An unknown feature fails
  yarn gen:choice-set-identities   validate and update the choiceSet stable-identity review artifact
  yarn gen:db                      generate Drizzle table definitions from module declarations (output is committed)

Options:
  --module / --domain / --around / --need   catalog selectors. Mutually exclusive. Pass only one
  --domains <path>                 domains root. Default is derived from the repo root
  --out <path>                     gen:db output directory. Default is tables/src at the repo root

catalog always prints JSON. There is no --json, no color, and no layout: its audience is a coding agent.
It emits only what cannot be read from source, or what reading source systematically gets wrong, plus coordinates for reading the source.
Field type / options / help / views are never emitted — they are in the source, with the "why" in the comments.

Gates are not here: run \`yarn test\`. Whole-repo module validation, cross-module references, and table-definition drift are tests.
Red means red. A gate that depends on someone remembering to run a command is no gate.

Split a modeling request into hard capabilities first and find raw material with yarn catalog --need ....
When changing an existing module, start with yarn catalog --module <target>, then use other modules to fill capabilities it lacks.
There is no scaffold command. A generated skeleton carries less information than a module that already works, and a coding agent is better at copying than at filling blanks.
A file existing means the module exists. The loader checks every convention at load time.
`;

/**
 * Default domains root. Three paths, most certain first:
 *
 * 1. `OE_DOMAINS` — explicit, the same variable name the server uses
 * 2. walk up from cwd until a directory contains domains/ — used when this package is installed as a dependency
 * 3. three directories up from this file — used when running inside the repo
 *
 * Step 2 cannot be dropped. With only step 3, a CLI living in `node_modules/@open-erp/builder/dist/`
 * walks up to `<root>/node_modules/domains`, a directory that does not exist. The error would point at that path,
 * which has nothing to do with the real cause (the CLI does not know it was installed as a dependency).
 */
function defaultDomainsRoot(): string {
  const override = process.env["OE_DOMAINS"];
  if (override !== undefined && override.trim() !== "") return path.resolve(override);

  for (let dir = process.cwd(); ; ) {
    if (existsSync(path.join(dir, "domains"))) return path.join(dir, "domains");
    const up = path.dirname(dir);
    // Reached the root. Do not complain here — the next path lets the loader report an error that includes the path.
    if (up === dir) break;
    dir = up;
  }
  return path.resolve(fileURLToPath(new URL("../../../", import.meta.url)), "domains");
}

interface Args {
  readonly command: string | undefined;
  readonly target: string | undefined;
  readonly module: string | null;
  readonly needs: readonly string[];
  readonly domain: string | null;
  readonly around: string | null;
  readonly domainsRoot: string;
  /** Only for gen:* commands that write files: report what was generated in machine form. catalog is always JSON and ignores this flag. */
  readonly json: boolean;
  readonly outDir: string;
  readonly outExplicit: boolean;
}

function valueOf(argv: readonly string[], at: number, what: string): string {
  const next = argv[at + 1];
  if (next === undefined || next === "" || next.startsWith("--")) throw new Error(what);
  return next;
}

function parseArgs(argv: readonly string[]): Args {
  const rest: string[] = [];
  const needs: string[] = [];
  let module: string | null = null;
  let domain: string | null = null;
  let around: string | null = null;
  let domainsRoot = defaultDomainsRoot();
  let outDir: string | null = null;
  let json = false;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--need") {
      // Comma-separated or repeated both land in the same list. An empty segment fails.
      // Dropping a segment silently would make "I filtered for this capability" and "the result has no such capability" both true.
      for (const feature of valueOf(argv, i, "--need requires a feature argument").split(",")) {
        if (feature.trim() === "") throw new Error("--need contains an empty feature segment");
        needs.push(feature.trim());
      }
      i++;
    } else if (arg === "--module") {
      module = valueOf(argv, i, "--module requires a module code");
      i++;
    } else if (arg === "--domains") {
      domainsRoot = path.resolve(valueOf(argv, i, "--domains requires a path argument"));
      i++;
    } else if (arg === "--domain") {
      domain = valueOf(argv, i, "--domain requires a domain code");
      i++;
    } else if (arg === "--around") {
      around = valueOf(argv, i, "--around requires a module code");
      i++;
    } else if (arg === "--json") {
      json = true;
    } else if (arg === "--out") {
      outDir = path.resolve(valueOf(argv, i, "--out requires a path argument"));
      i++;
    } else if (arg !== undefined) {
      rest.push(arg);
    }
  }

  return {
    command: rest[0],
    target: rest[1],
    json,
    module,
    needs,
    domain,
    around,
    domainsRoot,
    // Output lives at the repo-root `tables/`, not under `packages/`. It follows domains
    // (one new module is one new table), and packages/ is the framework. Mixed together,
    // a diff can no longer tell a business change from a framework change, which is the only thing a fork merge has to look at.
    outDir: outDir ?? path.resolve(domainsRoot, "../tables/src"),
    outExplicit: outDir !== null,
  };
}

/**
 * Collapse the selectors to one.
 *
 * Two at once is an error. There is no priority and no silent ignore. Any "who wins" rule means
 * the caller receives an answer it did not ask for, and nothing in the output shows that —
 * `--module warehouse --need x` would return a complete warehouse contract that reads as perfectly normal.
 */
function selectorOf(args: Args): CatalogSelector {
  const given = [
    args.module === null ? null : `--module ${args.module}`,
    args.domain === null ? null : `--domain ${args.domain}`,
    args.around === null ? null : `--around ${args.around}`,
    args.needs.length === 0 ? null : `--need ${args.needs.join(",")}`,
  ].filter((item): item is string => item !== null);
  if (given.length > 1) {
    throw new Error(`catalog selectors are mutually exclusive; pass only one, but ${given.length} were given: ${given.join(", ")}`);
  }
  if (args.module !== null) return { kind: "module", module: args.module };
  if (args.domain !== null) return { kind: "domain", domain: args.domain };
  if (args.around !== null) return { kind: "around", around: args.around };
  if (args.needs.length > 0) return { kind: "need", need: args.needs };
  return { kind: "repo" };
}

const GREEN = "[32m";
const RED = "[31m";
const DIM = "[2m";
const OFF = "[0m";

/** Parse arguments and render output. The logic is in index.ts / codegen.ts. This is only the shell. */
export async function run(argv: readonly string[], stdout: Sink, stderr: Sink): Promise<number> {
  const args = parseArgs(argv);

  if (!args.command || args.command === "help" || args.command === "--help") {
    stdout.write(USAGE);
    return 0;
  }

  switch (args.command) {
    case "catalog": {
      if (args.target) throw new Error(`catalog does not accept positional argument "${args.target}"; write the module as --module <code>`);
      const result = await catalog(args.domainsRoot, selectorOf(args));
      stdout.write(JSON.stringify(result, null, 2) + "\n");
      return 0;
    }

    case "gen:db": {
      if (args.domain !== null || args.around !== null) throw new Error("--domain / --around are only for overview");
      if (args.needs.length > 0) throw new Error("--need is only for materials");
      const result = await genDb(args.domainsRoot);
      mkdirSync(args.outDir, { recursive: true });

      // Clear, then write. When a module is deleted, its table definition has to disappear with it.
      // Overwriting without cleanup leaves an orphan that will never be updated but is still imported from somewhere other than index.ts,
      // and the migration it generates keeps creating a table that should already be gone.
      //
      // Delete only what this command wrote. The criterion is the generated banner at the top of the file.
      // A wrong `--out` one directory off would otherwise silently delete hand-written code (for example framework table definitions).
      // A command that only wants to regenerate must not be able to delete someone else's code.
      // An unrecognized file is kept and reported. A visible leftover is cheaper than a silent delete.
      const kept: string[] = [];
      for (const stale of readdirSync(args.outDir)) {
        if (!stale.endsWith(".ts")) continue;
        const at = path.join(args.outDir, stale);
        const source = readFileSync(at, "utf8");
        const firstLine = source.slice(0, source.indexOf("\n") === -1 ? undefined : source.indexOf("\n"));
        // The banner text is the criterion. Also accept a first line that names yarn gen:db,
        // so files generated before the banner was translated are still recognized as ours.
        if (source.startsWith(GENERATED_BANNER) || (firstLine.startsWith("//") && firstLine.includes("yarn gen:db"))) {
          rmSync(at);
          continue;
        }
        kept.push(stale);
      }
      if (kept.length) {
        stderr.write(
          `${DIM}Kept ${String(kept.length)} file(s) without the generated banner (${kept.join(", ")}) — ` +
            `they are not output of this command. If --out points at the wrong directory, change it now${OFF}\n`,
        );
      }
      for (const file of result.files) {
        writeFileSync(path.join(args.outDir, file.path), file.content, "utf8");
      }

      if (args.json) {
        stdout.write(JSON.stringify({ outDir: args.outDir, files: result.files.map((f) => f.path) }, null, 2) + "\n");
        return 0;
      }
      stdout.write(`${GREEN}✓${OFF} generated ${result.files.length} file(s) ${DIM}→ ${args.outDir}${OFF}\n`);
      for (const f of result.files) stdout.write(`    ${f.path}\n`);
      const analysisPath = path.join(args.outDir, "..", "analysis-catalog.json");
      writeFileSync(analysisPath, await genAnalysisCatalog(args.domainsRoot), "utf8");
      stdout.write(`${GREEN}✓${OFF} analysis catalog ${DIM}→ ${analysisPath}${OFF}\n`);
      const hatchesPath = path.join(args.outDir, "..", "hatches.json");
      writeFileSync(hatchesPath, await genHatches(args.domainsRoot), "utf8");
      stdout.write(`${GREEN}✓${OFF} escape hatches / surfaces / insights ${DIM}→ ${hatchesPath}${OFF}\n`);

      stdout.write(
        `\n${DIM}Commit the output: one generator change can change the column type of a hundred tables, and the diff is the only place a person can see that${OFF}\n`,
      );
      return 0;
    }

    case "gen:choice-set-identities": {
      if (args.target) throw new Error(`gen:choice-set-identities does not accept positional argument "${args.target}"`);
      if (args.domain !== null || args.around !== null) throw new Error("--domain / --around are only for overview");
      if (args.needs.length > 0) throw new Error("--need is only for materials");
      const artifact = args.outExplicit
        ? args.outDir
        : path.join(args.domainsRoot, "choice-set-identities.json");
      const previousText = readFileSync(artifact, "utf8");
      const previous = JSON.parse(previousText) as ChoiceSetIdentityManifest;
      const catalog = await loadCatalog({ domainsRoot: args.domainsRoot });
      const current = choiceSetIdentityManifest(catalog.choiceSets);
      // Must happen before writeFileSync: if a deletion or revival fails, the old artifact is left byte for byte.
      assertChoiceSetIdentityEvolution(previous, current);
      const content = renderChoiceSetIdentityManifest(current);
      mkdirSync(path.dirname(artifact), { recursive: true });
      writeFileSync(artifact, content, "utf8");
      if (args.json) {
        stdout.write(JSON.stringify({ artifact, choiceSets: current.choiceSets.length }, null, 2) + "\n");
      } else {
        stdout.write(`${GREEN}✓${OFF} choiceSet identity artifact validated and updated ${DIM}→ ${artifact}${OFF}\n`);
      }
      return 0;
    }

    default:
      stderr.write(`Unknown command "${args.command}"\n\n${USAGE}`);
      return 1;
  }
}

const invokedAs = process.argv[1];
const invokedPath = invokedAs === undefined ? "" : realpathSync(invokedAs);
if (import.meta.url === pathToFileURL(invokedPath).href) {
  await run(process.argv.slice(2), process.stdout, process.stderr).then(
    (code) => {
      process.exitCode = code;
    },
    (error: unknown) => {
      // Fail fast: show the error as-is. Do not swallow it or rewrite it.
      process.stderr.write(`${RED}${error instanceof Error ? error.message : String(error)}${OFF}\n`);
      process.exitCode = 1;
    },
  );
}
