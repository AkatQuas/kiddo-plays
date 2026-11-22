import { assertClosedKeys, requireObject, requireText, schemaFail } from "../schema/common.js";

export interface SemanticTerm {
  readonly ref: string; readonly cell: string; readonly label: string;
  readonly aliases: readonly string[]; readonly ambiguousAliases?: readonly string[]; readonly meaning: string;
}
export interface SemanticMonthlyTemplate {
  readonly ref: string; readonly metricRef: string; readonly module: string;
  readonly dateField: string; readonly valueField: string; readonly entityField: string;
  readonly entityModule: string; readonly entityNameField: string;
  readonly entityPrefixes: readonly string[];
  readonly patterns: readonly string[]; readonly statusPolicy: "all";
}
export interface SemanticDefinition {
  readonly packageRef: string; readonly terms: readonly SemanticTerm[];
  readonly templates: readonly SemanticMonthlyTemplate[];
}
const texts = (raw: unknown, at: string): readonly string[] => {
  if (!Array.isArray(raw) || !raw.length || raw.length > 30) schemaFail(`${at} must be an array of 1–30 items`);
  return raw.map((v, i) => requireText(v, `${at}[${i}]`));
};
const ref = (raw: unknown, at: string): string => {
  const v = requireText(raw, at);
  if (!/^[A-Za-z0-9_./-]{1,120}@\d+$/.test(v)) schemaFail(`${at} must be a versioned ref, for example orders.amount@1`);
  return v;
};

/** Explicit read-only definitions. Fields are checked against the loaded schema. */
export function normalizeSemantics(raw: unknown, cellKeys: readonly string[], at: string): SemanticDefinition {
  const o = requireObject(raw, at);
  assertClosedKeys(o, ["packageRef", "terms", "templates"], at);
  if (!Array.isArray(o["terms"]) || !o["terms"].length || o["terms"].length > 20) schemaFail(`${at}.terms must be an array of 1–20 items`);
  const terms = o["terms"].map((v, i): SemanticTerm => {
    const t = requireObject(v, `${at}.terms[${i}]`);
    assertClosedKeys(t, ["ref", "cell", "label", "aliases", "ambiguousAliases", "meaning"], at);
    const cell = requireText(t["cell"], `${at}.cell`);
    if (!cellKeys.includes(cell)) schemaFail(`${at}.cell "${cell}" is not a cell of the current insight`);
    return { ref: ref(t["ref"], at), cell, label: requireText(t["label"], at), aliases: texts(t["aliases"], at), ...(t["ambiguousAliases"] === undefined ? {} : { ambiguousAliases: texts(t["ambiguousAliases"], at) }), meaning: requireText(t["meaning"], at) };
  });
  if (new Set(terms.map(t => t.ref)).size !== terms.length) schemaFail(`${at}.terms has a duplicate ref`);
  if (!Array.isArray(o["templates"]) || o["templates"].length > 10) schemaFail(`${at}.templates must be an array of at most 10 items`);
  const templates = o["templates"].map((v, i): SemanticMonthlyTemplate => {
    const t = requireObject(v, `${at}.templates[${i}]`);
    assertClosedKeys(t, ["ref", "metricRef", "module", "dateField", "valueField", "entityField", "entityModule", "entityNameField", "entityPrefixes", "patterns", "statusPolicy"], at);
    const metricRef = ref(t["metricRef"], at);
    if (!terms.some(term => term.ref === metricRef)) schemaFail(`${at}.metricRef is not in the same semantic package`);
    if (t["statusPolicy"] !== "all") schemaFail(`${at}.statusPolicy currently only supports keeping every status; a new status policy must be defined on its own`);
    const patterns = texts(t["patterns"], at);
    for (const p of patterns) {
      const slots = p.match(/\{[^}]*\}/g) || [];
      if (slots.length !== 3 || !["{period}", "{entity}", "{metric}"].every(s => slots.includes(s))) schemaFail(`${at}.patterns must contain {period}, {entity}, and {metric} exactly once each`);
    }
    const entityPrefixes = t["entityPrefixes"] === undefined ? [] : texts(t["entityPrefixes"], at);
    return { ref: ref(t["ref"], at), metricRef, module: requireText(t["module"], at), dateField: requireText(t["dateField"], at), valueField: requireText(t["valueField"], at), entityField: requireText(t["entityField"], at), entityModule: requireText(t["entityModule"], at), entityNameField: requireText(t["entityNameField"], at), entityPrefixes, patterns, statusPolicy: "all" };
  });
  if (new Set(templates.map(t => t.ref)).size !== templates.length) schemaFail(`${at}.templates has a duplicate ref`);
  return { packageRef: ref(o["packageRef"], at), terms, templates };
}
