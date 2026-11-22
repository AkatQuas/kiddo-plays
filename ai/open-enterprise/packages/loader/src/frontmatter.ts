import { fail } from "./errors.js";

const QUOTE_CHARS = "\"'";

/**
 * The closed shape of one kind of frontmatter. Skill and agent definitions share one parser; only these three things differ.
 *
 * Share it instead of writing two: two parsers drift on quotes, duplicate keys, and empty values, and none of those cases report an error.
 * The drift shows up as the same spelling being legal under skills/ and silently becoming a different value under agents/.
 */
export interface FrontmatterSpec {
  /** Closed key set. Anything extra is rejected. */
  readonly keys: readonly string[];
  /** What this kind of document is called. Used only in error text. */
  readonly what: string;
  /**
   * Keys rejected by name → the reason.
   *
   * This and "unknown key" decide the same thing (both reject). The only difference is the wording, and the wording is the whole point:
   * someone who writes `model: gpt-4o` and hears "unknown key model" thinks they misspelled it or the feature is not built yet,
   * and files a request. Hearing "model routing is a platform runtime rule, and the host has no say in it" tells them this dimension
   * is not theirs to set. This step must run before the unknown-key check. Reverse the order and that wording never appears.
   */
  readonly forbidden: ReadonlyMap<string, string>;
}
/** A skill has no keys rejected by name — everything outside its closed set is simply unknown. */
export const NO_FORBIDDEN_KEYS: ReadonlyMap<string, string> = new Map();

/**
 * Frontmatter parsing. This is not a YAML parser. It is a deliberately narrow subset.
 *
 * The other side (the agent host) is not a YAML parser either: `extractFrontmatter` in `skill-md-schema.ts`
 * also splits on the first colon and treats the rest of the line as the value (the file header calls itself "the structural layer, flat key:value, no yaml dependency").
 * So an ASCII colon, `#`, or brackets inside a value are read the same way on both sides, and there is no gate on them — banning those characters for an imagined YAML semantics
 * would only force SOP authors to write a fullwidth colon.
 *
 * The one real disagreement is quotes: the other side's `stripQuotes` strips a paired wrapping `"` / `'`, and this side does not.
 * The same file would then yield two metadata copies that differ by one pair of quotes. Paired wrapping is therefore always rejected — a description does not need quotes anyway.
 */
export function parseFrontmatter(
  raw: string,
  at: string,
  spec: FrontmatterSpec,
): { readonly meta: ReadonlyMap<string, string>; readonly body: string } {
  const lines = raw.split(/\r?\n/);
  if (lines[0]?.trim() !== "---") {
    fail(`${at} has no frontmatter — ${spec.what} must start with --- and declare ${spec.keys.join(" / ")} inside it`);
  }
  const close = lines.findIndex((line, index) => index > 0 && line.trim() === "---");
  if (close < 0) fail(`${at} frontmatter has no closing ---`);

  const meta = new Map<string, string>();
  for (const line of lines.slice(1, close)) {
    if (!line.trim()) continue;
    const colon = line.indexOf(":");
    if (colon < 0) fail(`${at} frontmatter line "${line.trim()}" is not \`key: value\``);
    const key = line.slice(0, colon).trim();
    const value = line.slice(colon + 1).trim();
    // Named rejection runs before the unknown-key check. The other way around, `model` would hit the generic wording below,
    // and the author needs to hear "this dimension is not the host's", not "I do not recognize this key".
    const why = spec.forbidden.get(key);
    if (why !== undefined) fail(`${at} frontmatter key "${key}" ${why}`);
    if (!spec.keys.includes(key)) {
      fail(
        `${at} frontmatter does not recognize "${key}" — v1 only has ${spec.keys.join(" / ")}. ` +
          `An extra key is not sent and nobody reads it; adding a new dimension means changing the protocol on both sides together`,
      );
    }
    if (meta.has(key)) fail(`${at} frontmatter writes "${key}" twice — which copy wins depends on parse order`);
    if (!value) fail(`${at} frontmatter key "${key}" is empty — a missing value throws, and no default is filled in`);
    if (value.length >= 2 && QUOTE_CHARS.includes(value[0] ?? "") && value[value.length - 1] === value[0]) {
      fail(
        `${at} ${key} is wrapped as a pair by ${value[0] ?? ""} — the other side (agent host stripQuotes) strips that pair of quotes, ` +
          `and this side does not, so the same file differs by one pair of quotes on the two sides. Drop the quotes and write the value directly`,
      );
    }
    meta.set(key, value);
  }

  return { meta, body: lines.slice(close + 1).join("\n").trim() };
}

/**
 * `triggerWords: [due date, delay]` / `skillNames: [a, b]`. Only this one inline shape is accepted.
 *
 * A multiline list (`- due date`) is not accepted: this parser is not YAML. Reading multiple lines would mean handling indentation and nesting,
 * and that is exactly the door through which the two sides parse two different metadata copies.
 *
 * An empty array is always rejected and is not collapsed into "not written": `[]` and omission mean opposite things on some axes
 * (`allowedTools` omitted means no extra narrowing, `[]` means give no tools at all). Merging them into one thing
 * silently rewrites the decision the author wrote down. If there is no content, delete the whole line.
 */
export function inlineList(raw: string | undefined, key: string, at: string): readonly string[] | null {
  if (raw === undefined) return null;
  if (!raw.startsWith("[") || !raw.endsWith("]")) {
    fail(`${at} ${key} must be written as an inline array \`[a, b]\` — only this one shape is supported`);
  }
  const inner = raw.slice(1, -1).trim();
  if (!inner) fail(`${at} ${key} is an empty array — if there is no content, delete the whole line and do not leave an empty shell`);
  return inner.split(",").map((word, index) => {
    const trimmed = word.trim();
    if (!trimmed) fail(`${at} ${key}[${String(index)}] is an empty word`);
    return trimmed;
  });
}
