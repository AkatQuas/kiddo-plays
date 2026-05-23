# Node Obfuscate Compatibility Report

**Date:** May 23, 2026  
**Workspace:** `00_with_claude` / `test-obfuscate`  
**Runtime under test:** Node **22.16.0** (`node:22.16.0-slim`)  
**Also tested:** Node **22.19.0** (full image)

Setup and usage: [README.md](README.md)

---

## Executive Summary

We built a Docker-based compatibility harness to answer: *Can JavaScript obfuscated with bytenode on newer Node 22.x versions run on an older production Node runtime?*

**Finding:** Bytecode compiled with Node **22.21.0 through 22.22.1** runs successfully on runtime **22.16.0** and **22.19.0**. From **22.22.2** onward, V8 rejects the bytecode with `cachedDataRejected`. The compatibility boundary is between **22.22.1** and **22.22.2**.

| Compile (obfuscate) | Runtime 22.19.0 | Runtime 22.16.0-slim |
|---------------------|-----------------|----------------------|
| 22.21.0 | PASS | PASS |
| 22.21.1 | PASS | PASS |
| 22.22.0 | PASS | PASS |
| 22.22.1 | PASS | PASS |
| 22.22.2 | FAIL | FAIL |
| 22.22.3 | FAIL | FAIL |

**Score:** 4 passed / 6 tested (per runtime)

---

## Detailed Test Results

### Run 1 — Runtime `node:22.19.0` (full image)

Executed full matrix: compile versions `22.21.0 22.21.1 22.22.0 22.22.1 22.22.2 22.22.3`.

| Compile | Result | Output / error |
|---------|--------|----------------|
| 22.21.0 | PASS | `RESULT:25`, `NODE:v22.19.0` |
| 22.21.1 | PASS | `RESULT:25`, `NODE:v22.19.0` |
| 22.22.0 | PASS | `RESULT:25`, `NODE:v22.19.0` |
| 22.22.1 | PASS | `RESULT:25`, `NODE:v22.19.0` |
| 22.22.2 | FAIL | `Invalid or incompatible cached data (cachedDataRejected)` |
| 22.22.3 | FAIL | `Invalid or incompatible cached data (cachedDataRejected)` |

### Run 2 — Runtime `node:22.16.0-slim` (production-like)

Same compile matrix; runtime switched to slim image (smaller footprint, no install step).

| Compile | Result | Output / error |
|---------|--------|----------------|
| 22.21.0 | PASS | `RESULT:25`, `NODE:v22.16.0` |
| 22.21.1 | PASS | `RESULT:25`, `NODE:v22.16.0` |
| 22.22.0 | PASS | `RESULT:25`, `NODE:v22.16.0` |
| 22.22.1 | PASS | `RESULT:25`, `NODE:v22.16.0` |
| 22.22.2 | FAIL | `cachedDataRejected` |
| 22.22.3 | FAIL | `cachedDataRejected` |

**Conclusion:** Results are identical across both runtimes. The failure is driven by **V8 bytecode version**, not Docker image variant (slim vs full).

### Compatibility Boundary

```text
22.22.1  ──PASS──►  22.16.0 / 22.19.0
22.22.2  ──FAIL──►  cachedDataRejected
```

For production on **Node 22.16.0**, obfuscation CI should use Node **≤ 22.22.1** (or match the exact production V8 if compiling on the same major line).

---

## Implementation Effort

This section documents the work performed to deliver the harness and results.

### Planning Phase

- Explored existing [`obfuscate.js`](obfuscate.js) (originally Jenkins-gated, referenced missing `helper.mjs`, targeted `dist/index.js`).
- Designed Docker matrix: compile on N versions, run on fixed older runtime.
- Iterated with user on layout (`test-obfuscate/example/`), Node version list, and per-version isolated builds.

### Deliverables

| Artifact | Description |
|----------|-------------|
| `example/index.source.js` | Test app with 3 nested functions |
| `test-obfuscate/package.json` | Local bytenode dependency |
| `run-matrix.sh` | Automated 6-version matrix with pass/fail summary (`docker run` only) |
| `package.json` → `compat:matrix` | Root script to run matrix |
| Runtime defaults | `22.16.0-slim` via `RUNTIME_IMAGE` |

### Iterations and Fixes

1. **Plan mode → agent mode** — Initial file writes blocked; switched modes to implement.
2. **pnpm in Docker without TTY** — Added `CI=true` so `pnpm install` does not abort on `node_modules` purge.
3. **Lockfile mismatch in container** — Switched to `pnpm install --no-frozen-lockfile` inside Docker.
4. **Runtime path bug** — Fixed `Cannot find module '/app/index.js'` by running `node example/index.js` from correct working directory.
5. **bytenode install timing** — Moved install to obfuscate-only; runtime runs without `pnpm install`.
6. **Per-version isolation** — Introduced `builds/<version>/` so each Node compile version has its own `node_modules` and artifacts; runtime reuses that tree.
7. **Slim runtime image** — `node:22.16.0-slim` for smaller production-like runtime container.
8. **Full matrix execution** — Ran complete 6-version matrix twice (22.19.0 and 22.16.0-slim), ~1–2 minutes per full run including image pulls on first use.
9. **Removed Docker Compose dependency** — Matrix uses `docker run` only; Compose was optional and not needed for the test workflow.

### What Was Not Changed

- User’s core [`obfuscate.js`](obfuscate.js) logic (bytenode compile + loader stub) kept as-is.
- Compile images remain full `node:<version>` (need shell, corepack, pnpm for obfuscate).

---

## Recommendations

1. **Pin obfuscate Node in CI** to **22.22.1 or lower** if production runtime is **22.16.0** (or any runtime ≤ ~22.22.1 in this matrix).
2. **Avoid assuming forward compatibility** — bytecode compiled on newer V8 often fails on older runtimes (`cachedDataRejected`).
3. **Re-run matrix** when upgrading production Node or obfuscate Node — boundary may shift with patch releases.
4. **Keep `builds/` out of git** — generated artifacts; add to `.gitignore` if committing the repo.

---

*Re-run `pnpm compat:matrix` from the workspace root to refresh results after environment or version changes.*
