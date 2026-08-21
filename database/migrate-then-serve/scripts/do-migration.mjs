#!/usr/bin/env node
/**
 * do-migration — 每次调用生成**新的** migration 文件（工具不幂等）。
 *
 *   node scripts/do-migration.mjs              # 自动：新列 + 新行
 *   node scripts/do-migration.mjs add-column foo text
 *   node scripts/do-migration.mjs insert-item "demo-x"
 *   node scripts/do-migration.mjs up           # 生成 + compose up + verify
 *   node scripts/do-migration.mjs verify       # 对照 last.json 验 /api/schema
 */

import { runCompose, waitReady } from "./lib/compose.mjs";
import {
  generateAddColumn,
  generateAutoTick,
  generateInsertItem,
} from "./lib/migration-gen.mjs";
import { verifyLastManifest } from "./lib/verify.mjs";

function usage() {
  console.log(`用法:
  do-migration [auto]                 新列 + 新行（默认）
  do-migration add-column <名> [type]
  do-migration insert-item [name]
  do-migration up [--] [compose args...]  生成后 docker compose up --build 并 verify
  do-migration verify                 验证 last.json 期望已出现在运行中的 API`);
}


async function runGenerate(args) {
  const cmd = args[0] ?? "auto";
  let manifest;

  if (cmd === "auto" || cmd === "tick") {
    manifest = await generateAutoTick();
  } else if (cmd === "add-column") {
    manifest = await generateAddColumn(args[1], args[2] ?? "text");
  } else if (cmd === "insert-item") {
    manifest = await generateInsertItem(args[1]);
  } else {
    usage();
    process.exit(1);
  }

  console.log(`[do-migration] wrote migrator/migrations/${manifest.file}`);
  console.log(JSON.stringify(manifest, null, 2));
  return manifest;
}

async function main() {
  const argv = process.argv.slice(2);
  if (argv.includes("-h") || argv.includes("--help")) {
    usage();
    return;
  }

  const command = argv[0];

  if (command === "verify") {
    await verifyLastManifest();
    return;
  }

  if (command === "up") {
    const dash = argv.indexOf("--");
    const composeArgs = dash >= 0 ? argv.slice(dash + 1) : [];
    await runGenerate(["auto"]);
    runCompose(["-d", ...composeArgs]);
    await waitReady();
    await verifyLastManifest();
    return;
  }

  await runGenerate(argv);
  console.log("\n下一步:");
  console.log("  docker compose up --build --force-recreate migrate api -d");
  console.log("  npm run verify");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
