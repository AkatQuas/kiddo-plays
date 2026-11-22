import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fail } from "./errors.js";
import { isDirectory } from "./filesystem.js";
import { inlineList, parseFrontmatter } from "./frontmatter.js";
import type { LoadedSkill } from "./skill.js";

// ── agent definitions ─────────────────────────────────────────────────────
//
// An agent is a business-assistant definition delivered with the domain: how it
// helps a user inside the ERP, which business playbooks it follows, and whether
// it narrows the tools further. It lives at `domains/<domain>/agents/<id>.md`,
// on the same axis as modules and skills — through git, CI, and review, so a
// change is visible. This system currently ships one general Agent. It holds no
// business permission of its own. The actual tools, fields, actions, and data
// scope always come from the calling user's live authorization snapshot.
//
// The shape matches a skill (structured fields in frontmatter, body is
// `instructions`), so the parser, the quote rule, the closed key set, and
// "the file name is the identifier" are all shared. The differences are the
// field set and two gates that point in opposite directions:
//
// 1. The host may define what an agent is. It may not define how the runner runs.
//    Model routing (model / temperature …) and orchestration (orchestration / teams)
//    are platform runtime rules. Writing them here always throws. Silently ignoring
//    them would let the author believe they had already pinned the model.
//
// 2. Every `skillNames` entry must be a skill this repo actually has, checked at
//    load time. Leaving it until runtime means the other side fetches the full text
//    by name, gets a 404, and treats that as "the host hiccuped" — the model still
//    takes the stage, short one business playbook, and invents an ERP flow from common sense.

/** Shape of an id. It is both the file name and the path segment of `GET /api/agent/agents/:id`, so uppercase and whitespace are forbidden. */
const AGENT_ID = /^[a-z0-9][a-z0-9-]{0,63}$/;

/**
 * Three-part semantic version.
 *
 * Different rule from a skill's `version`: that one really is half of a cache key, and this one is not.
 * The shape is still three parts for one reason — someone reading a log should not have to remember two shapes (see `LoadedAgent.version`).
 */
const AGENT_VERSION = /^\d+\.\d+\.\d+$/;

/**
 * Closed frontmatter key set.
 *
 * This is not the field set that is sent: `roles` is used only for the host-side audience check and never goes on the wire
 * (the other side does not know it, and the other side also throws on an unknown field). See `LoadedAgent.roles`.
 */
const AGENT_KEYS = ["id", "name", "description", "version", "roles", "skillNames", "allowedTools", "experimental", "promptSurface", "preflight"] as const;

/**
 * Presentation tier — not an orchestration axis, so the host may define it.
 *
 * `lean` means "this agent emits no generative cards and dispatches no parallel workers", so the platform does not inject
 * the card protocol, the business-card vocabulary, or the handling-protocol wording. Measured, those three blocks are more than
 * eighty percent of a read-only experimental agent's system prompt, and it emits no cards — telling it about them only invites it to use abilities it does not have.
 *
 * Omitted (this key not written) = standard = byte-for-byte the same as before.
 */
const AGENT_PROMPT_SURFACES = ["standard", "lean"] as const;

/**
 * Keys rejected by name → why this dimension is not the host's.
 *
 * They all sit on the same boundary: the host defines what an agent is, and the platform defines how the runner runs.
 * The closed key set would reject them unnamed, but "does not recognize" would turn an architectural boundary into a spelling problem.
 */
const AGENT_FORBIDDEN_KEYS: ReadonlyMap<string, string> = new Map([
  ...(["model", "temperature", "topP", "maxTokens", "baseUrl", "apiKey"] as const).map(
    (key) =>
      [
        key,
        "is not for the host to declare — model routing and orchestration are runtime rules of the platform (agent host), " +
          "the host only defines what this agent is (persona, which business playbooks it binds, which tools it may touch), " +
          "and does not define how the runner runs. An ERP must not expose any baseUrl / apiKey configuration surface",
      ] as const,
  ),
  ...(["orchestration", "teams"] as const).map(
    (key) =>
      [
        key,
        "is not for the host to declare — orchestration policy belongs with model routing as a runtime rule of the platform (agent host). " +
          "The host can speak only of persona and asset bindings, and cannot say how several agents collaborate",
      ] as const,
  ),
]);

/** Where an agent definition sits on disk, and its declaration. */
export interface LoadedAgent {
  /** Unique id, globally unique (not namespaced by domain). Identical to the file name. */
  readonly id: string;
  readonly domain: string;
  /** Path relative to domains/, so an error can point back at it. */
  readonly file: string;
  /** Display name. It may be Chinese. */
  readonly name: string;
  /** One sentence for display. It enters the catalog, and the other side shows it in the assistant list. */
  readonly description: string;
  /**
   * Version. This is not a cache key — a different rule from `LoadedSkill.version`. Do not infer one from the other by symmetry.
   *
   * The other side (`registry/business-host/capability-client.ts`) does not cache agent definitions or the manifest /
   * tools / skills catalogs at all: the only thing there is an `inFlight` dedup
   * Map keyed by `requestId` (the key includes requestId, so it never hits across queries). Changed content therefore takes effect on the next query.
   * Bumping and not bumping are the same — the "if you do not bump you keep the old copy" conclusion drawn from the skill rule is the wrong cause.
   * Do not go looking for a TTL either: the env `BUSINESS_HOST_CAPABILITY_TTL_MS` has zero hits across the agent host,
   * and following it would send you to tune a number that does not exist.
   * (The only thing cached is the full text of a skill. See `LoadedSkill.version` and `host-skill-provider.ts`.)
   *
   * It is required for observability: a trace / log can say which persona version this round used.
   */
  readonly version: string;
  /**
   * Which role codes can see this agent. Stable RBAC role codes, not display names.
   * `*` is the only wildcard audience: any user with at least one valid role can see it.
   * It only controls whether the profile appears in the catalog. It does not grant tools, fields, actions, or data scope.
   *
   * Required and non-empty. There is no "omitted means every role" tier. A default would mean
   * a credit-control agent with roles left out appears in every role's assistant list, with zero errors —
   * while its persona states approval floors and exception-release rules.
   *
   * It does not go on the wire: this is the host's own trimming criterion, and the other side does not interpret it. Sending it would trigger
   * the other side's throw on an unknown field (protocol §2, last line).
   */
  readonly roles: readonly string[];
  /**
   * Bound host skill names. Existence is checked at load time (see `assertAgentSkillsKnown`).
   *
   * Omission normalizes to `[]` — this axis is a union on the other side (protocol §4). `[]` and omission are equivalent,
   * and always storing the array means a consumer does not write `?? []` at every read.
   */
  readonly skillNames: readonly string[];
  /**
   * Tool allow-list. `null` = do not narrow further (keep the capability pack's `allowedHostTools`).
   *
   * On this axis `null` and `[]` mean opposite things, so it cannot be normalized away the way `skillNames` is:
   * the other side intersects it with the tool catalog, and `[]` is an explicit decision to give no tools at all.
   * Filling the default in as `[]` would make every agent that omitted this line silently lose its entire tool surface,
   * and the symptom is "the AI refuses to do anything", with no log pointing at that intersection.
   */
  readonly allowedTools: readonly string[] | null;
  /**
   * An experimental agent: by default it enters nobody's catalog, and a deployment must name it explicitly before it appears
   * (`OE_EXPERIMENTAL_AGENTS`).
   *
   * This is a declaration bit rather than a framework check by id: checking by id would write one concrete agent's name
   * into the framework, which conflicts directly with "the framework must be business-agnostic". The mark lives on the agent. Whoever experiments, marks it.
   */
  readonly experimental: boolean;
  /** Presentation tier (closed set: `AGENT_PROMPT_SURFACES`). `null` = no statement = the platform uses standard. */
  readonly promptSurface: string | null;
  /**
   * Opening preflight: before the model speaks each round, the platform calls this tool once for it (the argument is the user's words for this round).
   * A card in the receipt is rendered for the user first; the rest is handed to the model as this round's opening context. `null` = no preflight.
   *
   * ## Why the host declares it
   *
   * It says which business context this agent should carry at the opening of each round — the same kind of thing as `skillNames` (which playbooks to bind).
   * It is an asset binding. It does not decide how the runner runs: it does not pick a model, set a round count, or orchestrate who collaborates with whom.
   * The call is that tool's ordinary path (same identity, same authorization, same audit). Only the moment is earlier.
   * A different axis from the rejected `orchestration` key.
   *
   * ## Why it is needed
   *
   * "Cannot write a query without reading the declaration" is a structural problem: the discovery result has to come back to the model before it can write the next step.
   * Measured (2026-09-20), the same question took 4–14 model round trips, 5–10 seconds each. The deterministic part
   * (quick-ask match, finding related modules, fetching the query card) moved to before the model costs zero model calls.
   *
   * Only a tool name is accepted here: how to call it (fixed parameters, which key holds the user's words) is that tool's own business,
   * supplied on the server per tool (see `packages/server/src/agent/agents.ts`). Whether the tool name exists and
   * whether it supports preflight is checked by the server at startup, the same as `allowedTools` — the loader does not copy the tool catalog.
   */
  readonly preflight: string | null;
  /**
   * Persona prompt: the body (everything after the frontmatter).
   *
   * Unlike a skill's `content`, this does not include the frontmatter. A skill sends the full text unchanged because
   * the other side parses the frontmatter as metadata too; an agent's metadata travels in JSON fields, and carrying another copy in the body
   * would be a second source of truth, which the model would read as part of the persona.
   */
  readonly instructions: string;
}

/**
 * Agent definition files under one domain. A directory, and anything that is not .md, is rejected for the same reasons as a skill.
 */
export function listAgentFiles(agentsDir: string, domain: string): readonly string[] {
  if (!isDirectory(agentsDir)) return [];
  const out: string[] = [];
  for (const entry of readdirSync(agentsDir).sort()) {
    if (entry.startsWith("_") || entry.startsWith(".")) continue;
    const full = path.join(agentsDir, entry);
    if (isDirectory(full)) {
      fail(
        `${domain}/agents/${entry} is a directory — an agent definition has only the single-file form (<id>.md). ` +
          `Attached files cannot be sent, and a sentence in the persona that points at them leads the model to a path it cannot open`,
      );
    }
    if (!entry.endsWith(".md")) {
      fail(`${domain}/agents/${entry} is not .md — agents/ holds only the agent definition itself`);
    }
    out.push(full);
  }
  return out;
}

export function loadAgent(file: string, domain: string, domainsRoot: string, agents: Map<string, LoadedAgent>): void {
  const relative = path.relative(domainsRoot, file);
  const { meta, body } = parseFrontmatter(readFileSync(file, "utf8"), relative, {
    keys: AGENT_KEYS,
    what: "agent definition",
    forbidden: AGENT_FORBIDDEN_KEYS,
  });

  const required = (key: string): string => {
    const value = meta.get(key);
    if (value === undefined) fail(`${relative} frontmatter is missing ${key} — no required field is given a default`);
    return value;
  };

  const id = required("id");
  if (!AGENT_ID.test(id)) {
    fail(`${relative} id "${id}" has an illegal shape — only lowercase letters, digits, and hyphens, and no more than 64 characters`);
  }
  // File name = id, the same rule as "module file name = code" and "skill file name = name".
  const expected = path.basename(file, ".md");
  if (id !== expected) {
    fail(`${relative}: the file name gives id "${expected}", but the frontmatter writes "${id}" — the two must match`);
  }
  const version = required("version");
  if (!AGENT_VERSION.test(version)) {
    fail(
      `${relative} version "${version}" is not x.y.z — it goes into traces / logs, ` +
        `and has the same shape as a skill version (someone reading a log should not have to remember two shapes)`,
    );
  }
  const clash = agents.get(id);
  if (clash) {
    fail(
      `agent id "${id}" is duplicated: ${clash.file} and ${relative} — the id is the globally unique path segment used to fetch the definition, ` +
        `and when names collide which one wins depends on scan order`,
    );
  }

  const roles = inlineList(meta.get("roles"), "roles", relative);
  if (roles === null) {
    fail(
      `${relative} frontmatter is missing roles — the agent catalog is trimmed by role, and this dimension has no safe default: ` +
        `"omitted means visible to every role" would put a control agent that forgot roles into everyone's assistant list, with zero errors`,
    );
  }
  if (roles.length === 0) fail(`${relative} roles must not be empty — a user with no role is rejected by the identity gate, and an empty audience is not how that is expressed`);
  if (roles.includes("*") && roles.length !== 1) {
    fail(`${relative} roles cannot list specific roles together with * — * already means visible to every user who has been assigned a role`);
  }

  const promptSurface = meta.get("promptSurface") ?? null;
  if (promptSurface !== null && !(AGENT_PROMPT_SURFACES as readonly string[]).includes(promptSurface)) {
    fail(
      `${relative} promptSurface "${promptSurface}" is not a known value. ` +
        `The closed set is ${AGENT_PROMPT_SURFACES.join(" | ")}`,
    );
  }
  const allowedTools = inlineList(meta.get("allowedTools"), "allowedTools", relative);
  const preflight = meta.get("preflight") ?? null;
  if (preflight !== null && !/^[A-Za-z_][A-Za-z0-9_]*$/.test(preflight)) {
    fail(`${relative} preflight "${preflight}" is not a tool name — write only a tool name here (for example erp). How it is called is decided by that tool`);
  }
  // Preflight must call a tool this agent can already call. If it is not in allowedTools, the intersection on the other side
  // never mounts the tool, preflight silently does nothing every round, and the only symptom is "this agent is slower than the others".
  if (preflight !== null && allowedTools !== null && !allowedTools.includes(preflight)) {
    fail(
      `${relative} preflight "${preflight}" is not in its own allowedTools — ` +
        `preflight uses that tool's ordinary path. A tool the agent itself cannot call, the platform will not call for it either`,
    );
  }

  // Only `true` / `false` / omitted are accepted. `yes` / `1` and the like always throw —
  // treating them silently as false would let the author believe they had hidden this agent, while it stays visible in production.
  const rawExperimental = meta.get("experimental");
  if (rawExperimental !== undefined && rawExperimental !== "true" && rawExperimental !== "false") {
    fail(
      `${relative} experimental must be true / false, received "${rawExperimental}" ` +
        `— this dimension decides whether it appears in production, and fuzzy spellings are not accepted`,
    );
  }
  const experimental = rawExperimental === "true";

  // The body is instructions. An empty body is a persona with no persona, and the model will invent business flows from common sense.
  if (!body) {
    fail(`${relative} has only frontmatter and no body — the body is the instructions (persona prompt), and leaving it empty is worse than not having this agent`);
  }

  agents.set(id, {
    id,
    domain,
    file: relative,
    name: required("name"),
    description: required("description"),
    version,
    roles,
    skillNames: inlineList(meta.get("skillNames"), "skillNames", relative) ?? [],
    allowedTools,
    promptSurface,
    preflight,
    experimental,
    instructions: body,
  });
}

/**
 * A skill named by `skillNames` must actually exist.
 *
 * Throw at load time, not at runtime: the other side (agent host) fetches the full text with `GET /api/agent/skills/:name`.
 * On a 404 it only knows "this SOP cannot be read right now" — the model still takes the stage, short one
 * business playbook, and then invents an ERP flow from common sense. And this was a spelling error.
 *
 * No default, and no silent drop: after the name is dropped the agent looks completely normal, only one playbook short of a binding,
 * and "one binding short" has no shape in any return value.
 */
export function assertAgentSkillsKnown(agents: ReadonlyMap<string, LoadedAgent>, skills: ReadonlyMap<string, LoadedSkill>): void {
  for (const agent of agents.values()) {
    for (const name of agent.skillNames) {
      if (skills.has(name)) continue;
      fail(
        `${agent.file} skillNames references a skill that does not exist, "${name}" — loaded: ` +
          `${[...skills.keys()].join(", ")}. ` +
          `Binding a playbook whose full text cannot be fetched does not raise an error. It only leaves the agent one business rule short when it takes the stage`,
      );
    }
  }
}
