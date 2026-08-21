import { API_BASE, fetchJson } from "./compose.mjs";
import { readLastManifest } from "./migration-gen.mjs";

export function assertIncludes(haystack, needle, label) {
  if (!haystack.includes(needle)) {
    throw new Error(`验证失败：${label} 缺少 ${JSON.stringify(needle)}，实际 ${JSON.stringify(haystack)}`);
  }
}

export async function fetchSchema() {
  const { status, body } = await fetchJson(`${API_BASE}/api/schema`);
  if (status !== 200) {
    throw new Error(`GET /api/schema → ${status}: ${JSON.stringify(body)}`);
  }
  return body;
}

/** 基线：001 + 002 已 apply，且后续 migration 不得破坏这些不变量 */
export function assertBaseline(body) {
  assertIncludes(body.migrations, "001_init", "migrations");
  assertIncludes(body.migrations, "002_add_status", "migrations");
  for (const col of ["id", "name", "created_at", "status"]) {
    assertIncludes(body.itemsColumns, col, "itemsColumns");
  }
  for (const name of ["alpha", "beta"]) {
    assertIncludes(body.itemNames, name, "itemNames");
  }
}

export async function verifyBaseline() {
  const body = await fetchSchema();
  assertBaseline(body);
  console.log("[verify:baseline] ok", {
    migrations: body.migrations,
    itemsColumns: body.itemsColumns,
    itemNames: body.itemNames,
  });
  return body;
}

export async function verifyLastManifest(manifest) {
  const expected = manifest ?? await readLastManifest();
  if (!expected) throw new Error("没有 .migration-gen/last.json，请先 do-migration 生成");

  const body = await fetchSchema();
  assertBaseline(body);
  const { expect } = expected;

  assertIncludes(body.migrations, expect.migrationVersion, "migrations");

  for (const col of expect.itemsColumnsIncludes ?? []) {
    assertIncludes(body.itemsColumns, col, "itemsColumns");
  }
  for (const name of expect.itemNamesIncludes ?? []) {
    assertIncludes(body.itemNames, name, "itemNames");
  }
  if (expect.itemFieldEquals) {
    const { name, field, value } = expect.itemFieldEquals;
    const row = body.items.find((item) => item.name === name);
    if (!row) throw new Error(`验证失败：找不到 item ${name}`);
    if (row[field] !== value) {
      throw new Error(`验证失败：${name}.${field} 期望 ${JSON.stringify(value)} 实际 ${JSON.stringify(row[field])}`);
    }
  }

  console.log("[verify:last] ok", expected.version);
  return { manifest: expected, schema: body };
}
