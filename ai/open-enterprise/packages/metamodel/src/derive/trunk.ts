/**
 * Trunk derivation — the "normal path" taken from the full status graph (including internal edges).
 *
 * It must be computed on the full graph, not on the residual graph after the
 * `readableSchema` projection. `readableSchema` strips `internal: true` edges
 * (for example production task `inProduction→completed`, production order
 * `awaitingRelease→releasing`). Those green terminals then have no incoming edge
 * in the residual graph, become islands, and the frontend DFS paints them as
 * off-track red crosses.
 *
 * The caller (the server `/api/modules/:code/schema` handler) should pass
 * `found.schema.lifecycle`, not the version after `readableSchema`.
 */

import type { Status, Transition } from "../schema/lifecycle.js";

const MAX_NODES = 24;

/**
 * The longest "normal" simple path starting from the initial state.
 *
 * Sort keys (the first key that differs decides):
 *   1. Prefer ending on a green terminal — on the full graph a green terminal
 *      has a real incoming edge and can be reached, replacing the frontend
 *      "non-terminal first" hack that compensated for the residual graph
 *   2. Longer
 *   3. Fewer red statuses (a normal flow should not pass through cancelled/rejected)
 *   4. More primary edges (each status's primary button is the usual next step)
 *   5. Declaration order (keep it stable)
 */
export function deriveTrunk(
  statuses: readonly Status[],
  transitions: readonly Transition[],
): readonly string[] {
  const initial = statuses.find((s) => s.initial) ?? statuses[0];
  if (initial === undefined) return [];
  if (statuses.length > MAX_NODES) return statuses.map((s) => s.key);

  const next = new Map<string, { readonly to: string; readonly primary: boolean }[]>();
  for (const t of transitions) {
    if (t.from === t.to) continue; // self-loops (keep scheduling / keep shipping) do not advance the flow
    const list = next.get(t.from);
    const edge = { to: t.to, primary: t.primary };
    if (list === undefined) next.set(t.from, [edge]);
    else list.push(edge);
  }

  const byKey = new Map(statuses.map((s) => [s.key, s]));
  const terminal = (key: string): boolean => byKey.get(key)?.terminal === true;
  const color = (key: string): string | undefined => byKey.get(key)?.color;
  const isGreenTerminal = (key: string): boolean => terminal(key) && color(key) === "green";
  const redCount = (path: readonly string[]): number => path.filter((k) => color(k) === "red").length;

  const better = (
    cand: { readonly path: readonly string[]; readonly primaries: number },
    inc: { readonly path: readonly string[]; readonly primaries: number },
  ): boolean => {
    const candEnd = cand.path[cand.path.length - 1];
    const incEnd = inc.path[inc.path.length - 1];
    if (candEnd === undefined || incEnd === undefined) return false;
    const candGreen = isGreenTerminal(candEnd);
    const incGreen = isGreenTerminal(incEnd);
    if (candGreen !== incGreen) return candGreen;
    if (cand.path.length !== inc.path.length) return cand.path.length > inc.path.length;
    const candRed = redCount(cand.path);
    const incRed = redCount(inc.path);
    if (candRed !== incRed) return candRed < incRed;
    if (cand.primaries !== inc.primaries) return cand.primaries > inc.primaries;
    return false;
  };

  let best = { path: [initial.key] as readonly string[], primaries: 0 };

  const walk = (node: string, path: readonly string[], primaries: number, seen: ReadonlySet<string>): void => {
    if (better({ path, primaries }, best)) best = { path, primaries };
    for (const edge of next.get(node) ?? []) {
      if (seen.has(edge.to)) continue; // simple path: back edges (withdraw / unapprove) are excluded here
      walk(edge.to, [...path, edge.to], primaries + (edge.primary ? 1 : 0), new Set([...seen, edge.to]));
    }
  };

  walk(initial.key, [initial.key], 0, new Set([initial.key]));
  return best.path;
}
