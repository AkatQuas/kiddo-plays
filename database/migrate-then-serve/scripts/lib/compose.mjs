import { spawnSync } from "node:child_process";
import { ROOT } from "./paths.mjs";

export const API_BASE = process.env.MIGRATE_THEN_SERVE_API ?? "http://127.0.0.1:18080";

export async function fetchJson(url) {
  const res = await fetch(url);
  const body = await res.json();
  return { status: res.status, body };
}

export async function waitReady(maxMs = 90_000) {
  const start = Date.now();
  while (Date.now() - start < maxMs) {
    try {
      const { status, body } = await fetchJson(`${API_BASE}/readyz`);
      if (status === 200 && body.ok) return body;
    } catch {
      // retry
    }
    await new Promise((r) => setTimeout(r, 1500));
  }
  throw new Error(`API 在 ${maxMs}ms 内未 ready：${API_BASE}/readyz`);
}

export function runCompose(extraArgs = ["-d"]) {
  // 只重建 migrate / api：db 靠 volume 保留，避免每次打掉 Postgres
  const args = [
    "compose",
    "up",
    "--build",
    "--force-recreate",
    "migrate",
    "api",
    ...extraArgs,
  ];
  console.log(`[compose] docker ${args.join(" ")}`);
  const result = spawnSync("docker", args, { cwd: ROOT, stdio: "inherit" });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

export function runComposeDown(removeVolumes = true) {
  const args = ["compose", "down", "--remove-orphans"];
  if (removeVolumes) args.push("-v");
  console.log(`[compose] docker ${args.join(" ")}`);
  const result = spawnSync("docker", args, { cwd: ROOT, stdio: "inherit" });
  if (result.status !== 0) process.exit(result.status ?? 1);
}
