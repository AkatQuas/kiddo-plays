#!/usr/bin/env node
/**
 * 端到端验证：
 *   1) reset → baseline compose → verify baseline
 *   2) auto / add-column / insert-item 各一轮 → compose → verify
 */

import { runCompose, waitReady } from "./lib/compose.mjs";
import {
  generateAddColumn,
  generateAutoTick,
  generateInsertItem,
} from "./lib/migration-gen.mjs";
import { verifyBaseline, verifyLastManifest } from "./lib/verify.mjs";
import { resetAll } from "./reset.mjs";

async function step(title, fn) {
  console.log(`\n========== ${title} ==========`);
  await fn();
}

async function generateAndApply(label, generator) {
  const manifest = await generator();
  console.log(`[flow] generated ${manifest.file} (${label})`);
  runCompose(["-d"]);
  await waitReady();
  await verifyLastManifest(manifest);
}

async function main() {
  await step("RESET", () => resetAll());

  await step("BASELINE: compose + verify", async () => {
    runCompose(["-d"]);
    await waitReady();
    await verifyBaseline();
  });

  await step("MIGRATION auto (列+行)", () =>
    generateAndApply("auto", () => generateAutoTick()));

  await step("MIGRATION add-column", () =>
    generateAndApply("add-column", () => generateAddColumn("priority", "text")));

  await step("MIGRATION insert-item", () =>
    generateAndApply("insert-item", () => generateInsertItem("verify-row-3")));

  console.log("\n[flow] ALL PASSED");
}

main().catch((error) => {
  console.error("\n[flow] FAILED:", error instanceof Error ? error.message : error);
  process.exit(1);
});
