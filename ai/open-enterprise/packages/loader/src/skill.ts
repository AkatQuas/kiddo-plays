import { createHash } from "node:crypto";
import { lstatSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fail } from "./errors.js";
import { isDirectory } from "./filesystem.js";
import { inlineList, NO_FORBIDDEN_KEYS, parseFrontmatter } from "./frontmatter.js";

// ── business skills ───────────────────────────────────────────────────────
//
// A skill is a business playbook delivered with the domain: for "can this order
// ship on time", which documents to check, in what order, and which number must
// not be used to draw a conclusion. It lives at `domains/<domain>/skills/<name>.md`,
// on the same axis as module declarations — through git, CI, and review, so a
// change is visible.
//
// This package discovers them, instead of letting each consumer `readFileSync`
// and scan the directory itself: the reason is the same as for the module table.
// Scanning in two places shows up as "this skill is on the HTTP endpoint and missing
// from the CLI check", with no error.
//
// v2 supports the standard directory form: `skills/<name>/SKILL.md` plus one layer of `references/*.md`.
// The flat `skills/<name>.md` form stays supported, and an ordinary namespace is unaffected; other attached directories are still rejected.

/** Shape of a name. It is both the file name and the path segment of `GET /api/agent/skills/:name`, so uppercase and whitespace are forbidden. */
const SKILL_NAME = /^[a-z0-9][a-z0-9-]{0,63}$/;

/** Three-part semantic version. The human-read dimension: it can say "which version this is", and it has the same shape as an agent definition. */
const SKILL_VERSION = /^\d+\.\d+\.\d+$/;

/**
 * Closed frontmatter key set.
 *
 * An extra key is always rejected, never silently ignored: the v2 extension point (the attached-file list) lives here,
 * and a key that "is written today and takes effect tomorrow" would let the author believe they had already declared it.
 */
const SKILL_KEYS = ["name", "description", "version", "triggerWords"] as const;


/**
 * Everything parsed out of one SKILL.md. Independent of disk.
 *
 * It is split from `LoadedSkill` because "whether a SKILL.md holds together" and "where it sits on disk"
 * are not the same thing. The only criterion is `parseSkillDocument`; `loadSkill` only adds "where the file is".
 */
export interface ParsedSkill {
  /** Unique id. Inside a repo playbook it matches the file name exactly; in a tenant skill it matches the URL path segment exactly. */
  readonly name: string;
  /**
   * The one sentence that stays in the model's resident context: the model decides whether to expand the full text from this sentence alone.
   *
   * So it must say "when to use this", not "what this talks about" — the latter is useful only after expansion,
   * and the decision to expand is made from this sentence.
   */
  readonly description: string;
  /** Declared semantic version. The human-read dimension — communication and release notes use it. The cache does not. */
  readonly version: string;
  /**
   * Version on the wire: `<declared version>+<full-text fingerprint>` (for example `1.0.0+a1b2c3d4`).
   *
   * The body fingerprint lives here because "remember to bump when you change it" should not be a rule.
   * The other side caches skill full text by `name@version`, and that cache (`bodyCache` in `host-skill-provider.ts`)
   * has no TTL, only an LRU cap — not bumping is not "you get the old one for 45 seconds". It is
   * keeping the old copy forever, until it is evicted or the process restarts. Neither side reports an error. The only symptom is "I did change it".
   *
   * Once the fingerprint is spliced in, changing the body changes the wire version, which invalidates the other side's cache. Bumping and not bumping
   * both get the right behavior, so the rule does not need to exist — review is not what holds it up.
   *
   * Why not use the fingerprint as the version outright: then a person could no longer say "this is 1.0 or 2.0".
   * The two uses (human communication / machine invalidation) each need a dimension. Collapsing them into one always sacrifices one.
   *
   * The other side treats it as an opaque string (measured: it only concatenates `name@version` and parses with `lastIndexOf('@')`,
   * and does not parse semantics), so adding a suffix does not need the other side to cooperate.
   */
  readonly wireVersion: string;
  /** Retrieval boost words. No declaration means an empty array — after normalization it is always present, so a consumer does not write `?? []` at every read. */
  readonly triggerWords: readonly string[];
  /**
   * The full text of SKILL.md, frontmatter kept as-is.
   *
   * Metadata is not stripped out of the body: metadata on the catalog endpoint and the full-text endpoint must match exactly,
   * and the cheapest way to guarantee that is that both come from the same parse of the same text.
   */
  readonly content: string;
  /** One layer of reference documents loaded on demand. The body does not inline reference content. */
  readonly references?: readonly SkillReference[];
}

export interface SkillReference {
  readonly name: string;
  readonly description: string;
  readonly version: string;
  readonly wireVersion: string;
  readonly content: string;
  readonly file: string;
}

export const SKILL_REFERENCE_MAX_COUNT = 16;
export const SKILL_REFERENCE_MAX_BYTES = 24 * 1024;
export const SKILL_REFERENCES_TOTAL_MAX_BYTES = 96 * 1024;

/**
 * One business playbook — the parsed content plus where it sits on disk.
 *
 * The two extra dimensions exist only for in-repo playbooks: a tenant upload at runtime does not live under `domains/`
 * and does not belong to any domain. So they live on this layer, not on `ParsedSkill` — putting them there would force
 * the upload path to invent a fake `domain` / `file` for every entry, and those two values would later appear in error messages
 * pointing at a file that does not exist.
 */
export interface LoadedSkill extends ParsedSkill {
  readonly domain: string;
  /** Path relative to domains/, so an error can point back at it. */
  readonly file: string;
}

/**
 * Skill files under one domain.
 *
 * A directory form and anything that is not .md are always rejected, never silently skipped: skipping shows up as "I did write this skill",
 * and it is not on the endpoint, with no message at all.
 */
export function listSkillFiles(skillsDir: string, domain: string): readonly string[] {
  if (!isDirectory(skillsDir)) return [];
  const out: string[] = [];
  for (const entry of readdirSync(skillsDir).sort()) {
    if (entry.startsWith("_") || entry.startsWith(".")) continue;
    const full = path.join(skillsDir, entry);
    if (lstatSync(full).isSymbolicLink()) fail(`${domain}/skills/${entry} symbolic links are not allowed`);
    if (isDirectory(full)) {
      const skillFile = path.join(full, "SKILL.md");
      if (!pathExists(skillFile)) {
        fail(`${domain}/skills/${entry} is a directory — the directory form must contain SKILL.md`);
      }
      if (pathExists(skillFile)) out.push(skillFile);
      continue;
    }
    if (!entry.endsWith(".md")) {
      fail(`${domain}/skills/${entry} is not .md — skills/ holds only the business playbook itself`);
    }
    out.push(full);
  }
  return out;
}

function pathExists(file: string): boolean {
  try {
    if (lstatSync(file).isSymbolicLink()) return false;
    lstatSync(file);
    return true;
  } catch {
    return false;
  }
}

function isSymbolicLinkPath(file: string): boolean {
  try {
    return lstatSync(file).isSymbolicLink();
  } catch {
    return false;
  }
}

/** Optional gates for `parseSkillDocument`. */
export interface ParseSkillOptions {
  /**
   * Expected name. When given, it is checked, and a mismatch throws.
   *
   * An in-repo playbook has the file name passed in by `loadSkill`. It must match the one in the frontmatter exactly —
   * without the check, a document with `name: b` can sit at coordinate `a`. After that the catalog says `b`
   * and fetching the full text uses `a`, and neither side reports an error.
   *
   * Omitting it (`undefined`) means this dimension has no second source to compare against. It does not mean "skip the check".
   */
  readonly expectedName?: string;
}

/**
 * Parse one SKILL.md. A pure function with zero IO — the only source of truth for the criteria.
 *
 * In-repo playbooks call it at load time. A second copy of the criteria would drift on quotes, empty values, and the closed key set, none of which report an error.
 *
 * @param at Coordinate that appears in every error. An in-repo playbook passes the relative path. It only enters the wording and takes part in no decision.
 */
export function parseSkillDocument(content: string, at: string, options: ParseSkillOptions = {}): ParsedSkill {
  const { meta, body } = parseFrontmatter(content, at, {
    keys: SKILL_KEYS,
    what: "SKILL.md",
    forbidden: NO_FORBIDDEN_KEYS,
  });
  // An empty body means the model gets zero information after expanding. Then "this skill exists" is worse than not having it:
  // it will believe it has already looked.
  if (!body) fail(`${at} has only frontmatter and no body — a skill that yields nothing after expansion is worse than not having it`);

  const required = (key: string): string => {
    const value = meta.get(key);
    if (value === undefined) fail(`${at} frontmatter is missing ${key} — none of the three required fields is given a default`);
    return value;
  };

  const name = required("name");
  if (!SKILL_NAME.test(name)) {
    fail(`${at} name "${name}" has an illegal shape — only lowercase letters, digits, and hyphens, and no more than 64 characters`);
  }
  // File name = name, the same rule as "module file name = code": a mapping table is a second source of truth and drifts on rename.
  const expected = options.expectedName;
  if (expected !== undefined && name !== expected) {
    fail(`${at}: the coordinate gives name "${expected}", but the frontmatter writes "${name}" — the two must match`);
  }
  const version = required("version");
  if (!SKILL_VERSION.test(version)) {
    fail(`${at} version "${version}" is not x.y.z — same shape as an agent definition, so someone reading a log does not have to remember two shapes`);
  }

  return {
    name,
    description: required("description"),
    version,
    // The fingerprint covers the full text (frontmatter included): the full-text endpoint returns the whole file.
    // Hashing only the body would make the catalog say new after a description change while the full-text cache is still old.
    wireVersion: `${version}+${createHash("sha256").update(content, "utf8").digest("hex").slice(0, 8)}`,
    triggerWords: inlineList(meta.get("triggerWords"), "triggerWords", at) ?? [],
    content,
    references: [],
  };
}

const REFERENCE_NAME = /^[a-z0-9][a-z0-9-]{0,63}$/;
const REFERENCE_KEYS = ["name", "description", "version"] as const;

function parseSkillReferenceDocument(content: string, at: string, expectedName: string): SkillReference {
  const { meta, body } = parseFrontmatter(content, at, {
    keys: REFERENCE_KEYS,
    what: "skill reference",
    forbidden: NO_FORBIDDEN_KEYS,
  });
  if (!body) fail(`${at} has only frontmatter and no body — a reference must not collapse into an empty document`);
  const required = (key: string): string => {
    const value = meta.get(key);
    if (value === undefined) fail(`${at} frontmatter is missing ${key}`);
    return value;
  };
  const name = required("name");
  if (name !== expectedName || !REFERENCE_NAME.test(name)) {
    fail(`${at} name "${name}" must match the reference file name "${expectedName}" and use lowercase hyphens`);
  }
  const version = required("version");
  if (!/^\d+\.\d+\.\d+$/.test(version)) fail(`${at} version "${version}" is not x.y.z`);
  return {
    name,
    description: required("description"),
    version,
    wireVersion: `${version}+${createHash("sha256").update(content, "utf8").digest("hex").slice(0, 8)}`,
    content,
    file: at,
  };
}

function loadSkillReferences(skillFile: string, domainsRoot: string): readonly SkillReference[] {
  const root = path.dirname(skillFile);
  if (path.basename(skillFile) !== "SKILL.md") return [];
  for (const entry of readdirSync(root).sort()) {
    if (entry.startsWith("_") || entry.startsWith(".")) continue;
    if (entry !== "SKILL.md" && entry !== "references") {
      fail(`${path.relative(domainsRoot, path.join(root, entry))} is not a one-layer resource allowed by a v2 Skill`);
    }
  }
  const referencesDir = path.join(root, "references");
  if (isSymbolicLinkPath(referencesDir)) {
    fail(`${path.relative(domainsRoot, referencesDir)} symbolic links are not allowed`);
  }
  if (!isDirectory(referencesDir)) {
    if (pathExists(referencesDir)) {
      fail(`${path.relative(domainsRoot, referencesDir)} must be a directory`);
    }
    return [];
  }
  const entries = readdirSync(referencesDir).sort();
  if (entries.filter((entry) => !entry.startsWith("_") && !entry.startsWith(".")).length > SKILL_REFERENCE_MAX_COUNT) {
    fail(`${path.relative(domainsRoot, referencesDir)} reference count exceeds ${SKILL_REFERENCE_MAX_COUNT}`);
  }
  const references: SkillReference[] = [];
  const seen = new Set<string>();
  let totalBytes = 0;
  for (const entry of entries) {
    if (entry.startsWith("_") || entry.startsWith(".")) continue;
    const full = path.join(referencesDir, entry);
    if (lstatSync(full).isSymbolicLink()) fail(`${path.relative(domainsRoot, full)} symbolic links are not allowed`);
    if (isDirectory(full)) fail(`${path.relative(domainsRoot, full)} nested references directories are not allowed`);
    if (!entry.endsWith(".md")) fail(`${path.relative(domainsRoot, full)} is not .md`);
    const name = path.basename(entry, ".md");
    if (seen.has(name)) fail(`${path.relative(domainsRoot, full)} reference name is duplicated`);
    seen.add(name);
    const content = readFileSync(full, "utf8");
    const bytes = Buffer.byteLength(content, "utf8");
    if (bytes > SKILL_REFERENCE_MAX_BYTES) {
      fail(`${path.relative(domainsRoot, full)} exceeds the per-reference budget of ${SKILL_REFERENCE_MAX_BYTES} bytes`);
    }
    totalBytes += bytes;
    if (totalBytes > SKILL_REFERENCES_TOTAL_MAX_BYTES) {
      fail(`${path.relative(domainsRoot, referencesDir)} exceeds the total reference budget of ${SKILL_REFERENCES_TOTAL_MAX_BYTES} bytes`);
    }
    references.push(parseSkillReferenceDocument(content, path.relative(domainsRoot, full), name));
  }
  return references;
}

export function loadSkill(file: string, domain: string, domainsRoot: string, skills: Map<string, LoadedSkill>): void {
  const relative = path.relative(domainsRoot, file);
  // The criteria all live in the pure function; this layer only adds the two "where is the file" facts — the file name is the name (handed to
  // the same criteria through `expectedName`), and the name is unique across files.
  const parsed = parseSkillDocument(readFileSync(file, "utf8"), relative, {
    expectedName: path.basename(file) === "SKILL.md" ? path.basename(path.dirname(file)) : path.basename(file, ".md"),
  });
  const clash = skills.get(parsed.name);
  if (clash) {
    fail(
      `skill name "${parsed.name}" is duplicated: ${clash.file} and ${relative} — name is the globally unique path segment used to fetch the full text, ` +
        `and when names collide which one wins depends on scan order`,
    );
  }

  skills.set(parsed.name, {
    ...parsed,
    references: loadSkillReferences(file, domainsRoot),
    domain,
    file: relative,
  });
}
