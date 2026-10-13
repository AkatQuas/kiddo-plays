#!/usr/bin/env node
/**
 * Capability probe for @trycua/cua-driver.
 *
 * Default: observational tests only (safe — no clicks/typing).
 * Pass --interact to also exercise cursor move / clipboard / click / type.
 *
 * Usage:
 *   node test-capabilities.mjs
 *   node test-capabilities.mjs --interact
 *   node test-capabilities.mjs --out ./out
 *
 * macOS needs Accessibility + Screen Recording for the Node process.
 */

import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  ActionTarget,
  ClickButton,
  ClickInput,
  ClickPosition,
  ClipboardReadInput,
  ClipboardWriteInput,
  CuaDriver,
  EndSessionInput,
  GetCursorPositionInput,
  GetDesktopStateInput,
  GetScreenSizeInput,
  GetSessionInput,
  GetWindowStateInput,
  InputDeliveryMode,
  ListAppsInput,
  ListWindowsInput,
  MoveCursorInput,
  StartSessionInput,
  TypeTextInput,
} from "@trycua/cua-driver";

const __dirname = dirname(fileURLToPath(import.meta.url));
const args = new Set(process.argv.slice(2));
const interact = args.has("--interact");
const outIdx = process.argv.indexOf("--out");
const outDir = resolve(
  outIdx >= 0 && process.argv[outIdx + 1]
    ? process.argv[outIdx + 1]
    : join(__dirname, "out"),
);

const SESSION = "capability-probe";

/** @type {{ name: string; ok: boolean; detail?: string; error?: string }[]} */
const results = [];

function pass(name, detail) {
  results.push({ name, ok: true, detail });
  console.log(`  ✓ ${name}${detail ? ` — ${detail}` : ""}`);
}

function formatError(error) {
  if (error && typeof error === "object") {
    const inner = error.inner;
    if (inner && typeof inner === "object") {
      const code = inner.errorCode ?? inner.code;
      const tool = inner.tool;
      const message = inner.message ?? error.message;
      return [code, tool && `tool=${tool}`, message].filter(Boolean).join(": ");
    }
    if (error.message) return error.message;
  }
  return String(error);
}

function fail(name, error) {
  const msg = formatError(error);
  results.push({ name, ok: false, error: msg });
  console.log(`  ✗ ${name} — ${msg}`);
}

async function probe(name, fn) {
  try {
    const detail = await fn();
    pass(name, detail);
    return true;
  } catch (err) {
    fail(name, err);
    return false;
  }
}

function jsonSafe(value) {
  return JSON.stringify(
    value,
    (_key, v) => (typeof v === "bigint" ? v.toString() : v),
    2,
  );
}

function summarizeToolResult(result, { maxText = 120 } = {}) {
  if (result.isError) {
    throw new Error(
      `${result.errorCode ?? "error"}: ${result.text || result.rawJson}`,
    );
  }
  const bits = [];
  if (result.text) {
    bits.push(
      result.text.length > maxText
        ? `${result.text.slice(0, maxText)}…`
        : result.text.replace(/\s+/g, " ").trim(),
    );
  }
  if (result.images?.length) {
    bits.push(
      `${result.images.length} image(s): ${result.images
        .map((i) => i.mimeType)
        .join(", ")}`,
    );
  }
  if (result.degraded) bits.push("degraded");
  if (result.structuredJson) {
    try {
      const parsed = JSON.parse(result.structuredJson);
      bits.push(`structured keys: ${Object.keys(parsed).join(",") || "(empty)"}`);
    } catch {
      bits.push("structuredJson present");
    }
  }
  return bits.join(" | ") || "(empty result)";
}

async function saveScreenshot(images, filename) {
  const image = images?.[0];
  const payload = image?.dataBase64 ?? image?.data;
  if (!payload) return null;
  await mkdir(outDir, { recursive: true });
  const path = join(outDir, filename);
  const buf = Buffer.isBuffer(payload)
    ? payload
    : Buffer.from(payload, typeof payload === "string" ? "base64" : undefined);
  await writeFile(path, buf);
  return path;
}

async function main() {
  console.log("@trycua/cua-driver capability probe");
  console.log(`  interact=${interact}  out=${outDir}\n`);

  let driver;
  await probe("CuaDriver.create()", () => {
    driver = CuaDriver.create(undefined);
    return `available=${driver.isAvailable()} mode=${driver.executionMode()} socket=${JSON.stringify(driver.socketPath())}`;
  });
  if (!driver) {
    printSummary();
    process.exit(1);
  }

  try {
    await probe("metadata()", async () => {
      const m = await driver.metadata();
      return `driver=${m.driverVersion} contract=${m.contractVersion} capability=${m.capabilityVersion} embedded=${m.embedded} pid=${m.pid}`;
    });

    await probe("listToolsJson()", async () => {
      const json = await driver.listToolsJson();
      const parsed = JSON.parse(json);
      const tools = Array.isArray(parsed)
        ? parsed
        : Array.isArray(parsed?.tools)
          ? parsed.tools
          : [];
      const names = tools.map((t) => t.name ?? t.tool ?? "?").filter(Boolean);
      await mkdir(outDir, { recursive: true });
      await writeFile(join(outDir, "tools.json"), json);
      return `${names.length} tools → out/tools.json (${names.slice(0, 8).join(", ")}${names.length > 8 ? ", …" : ""})`;
    });

    await probe("startSession()", async () => {
      const out = await driver.startSession(
        StartSessionInput.new({ session: SESSION }),
      );
      return `active=${out.active} revived=${out.revived}`;
    });

    await probe("getSession()", async () => {
      const out = await driver.getSession(
        GetSessionInput.new({ session: SESSION }),
      );
      return jsonSafe(out).replace(/\s+/g, " ").slice(0, 160);
    });

    await probe("getScreenSize()", async () => {
      const result = await driver.getScreenSize(
        GetScreenSizeInput.new({ session: SESSION }),
      );
      return summarizeToolResult(result);
    });

    await probe("getDesktopState() screenshot", async () => {
      const shotPath = join(outDir, "desktop.png");
      const result = await driver.getDesktopState(
        GetDesktopStateInput.new({
          session: SESSION,
          screenshotOutFile: shotPath,
          maxImageDimension: 1280,
        }),
      );
      const summary = summarizeToolResult(result);
      const saved =
        (await saveScreenshot(result.images, "desktop-inline.png")) ?? shotPath;
      return `${summary} → ${saved}`;
    });

    await probe("getCursorPosition()", async () => {
      const result = await driver.getCursorPosition(
        GetCursorPositionInput.new({ session: SESSION }),
      );
      return summarizeToolResult(result);
    });

    /** @type {import("@trycua/cua-driver").ListAppsOutput | undefined} */
    let apps;
    await probe("listApps()", async () => {
      apps = await driver.listApps(ListAppsInput.new({}));
      const running = apps.apps.filter((a) => a.running);
      const sample = running
        .slice(0, 5)
        .map((a) => `${a.name}(pid=${a.pid})`)
        .join(", ");
      await mkdir(outDir, { recursive: true });
      await writeFile(join(outDir, "apps.json"), jsonSafe(apps.apps));
      return `${apps.apps.length} apps, ${running.length} running → out/apps.json | ${sample}`;
    });

    /** @type {import("@trycua/cua-driver").ListWindowsOutput | undefined} */
    let windows;
    await probe("listWindows(onScreenOnly)", async () => {
      windows = await driver.listWindows(
        ListWindowsInput.new({ onScreenOnly: true }),
      );
      const sample = windows.windows
        .slice(0, 5)
        .map((w) => `${w.appName}:${w.title || "(untitled)"}`)
        .join(" | ");
      await mkdir(outDir, { recursive: true });
      await writeFile(join(outDir, "windows.json"), jsonSafe(windows.windows));
      return `${windows.windows.length} on-screen → out/windows.json | ${sample}`;
    });

    // Prefer apps with reliable AX; include zh-CN localized names (M1 host).
    const preferred = [
      "Ghostty",
      "Terminal",
      "终端",
      "iTerm2",
      "Finder",
      "访达",
      "TextEdit",
      "文本编辑",
      "Safari",
      "Google Chrome",
      "Microsoft Edge",
      "Cursor",
      "Code",
      "Visual Studio Code",
    ];
    const skipApps = new Set([
      "universalAccessAuthWarn",
      "系统设置",
      "System Settings",
      "System Preferences",
      "登录窗口",
      "SecurityAgent",
    ]);

    /** @type {{ window: any, state: any } | null} */
    let actionable = null;

    await probe("pick actionable window (AX-ready)", async () => {
      const candidates = (windows?.windows ?? [])
        .filter(
          (w) =>
            w.pid != null &&
            w.isOnScreen &&
            !skipApps.has(w.appName) &&
            w.onCurrentSpace !== false,
        )
        .sort((a, b) => {
          const ai = preferred.indexOf(a.appName);
          const bi = preferred.indexOf(b.appName);
          return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
        });

      if (!candidates.length) {
        throw new Error("no on-screen candidate windows");
      }

      await mkdir(outDir, { recursive: true });
      const attempts = [];
      for (const candidate of candidates.slice(0, 8)) {
        try {
          const state = await driver.getWindowState(
            GetWindowStateInput.new({
              pid: candidate.pid,
              windowId: candidate.windowId,
              session: SESSION,
              includeAccessibilityTree: true,
              includeScreenshot: false,
              maxElements: 40,
              maxDepth: 8,
            }),
          );
          const elements = state.elements ?? [];
          const ok = !state.degraded && elements.length > 0;
          attempts.push({
            app: candidate.appName,
            title: candidate.title || "(untitled)",
            windowId: candidate.windowId.toString(),
            elements: elements.length,
            degraded: Boolean(state.degraded),
            reason: state.degradedReason,
            ok,
          });
          if (ok && !actionable) {
            actionable = { window: candidate, state };
          }
        } catch (err) {
          attempts.push({
            app: candidate.appName,
            title: candidate.title || "(untitled)",
            windowId: candidate.windowId.toString(),
            ok: false,
            error: formatError(err),
          });
        }
      }
      await writeFile(join(outDir, "window-pick.json"), jsonSafe(attempts));

      // Fall back to first preferred/on-screen window for observation even if AX is weak.
      if (!actionable && candidates[0]) {
        const state = await driver.getWindowState(
          GetWindowStateInput.new({
            pid: candidates[0].pid,
            windowId: candidates[0].windowId,
            session: SESSION,
            includeAccessibilityTree: true,
            includeScreenshot: true,
            screenshotOutFile: join(outDir, "window.png"),
            maxElements: 40,
            maxDepth: 8,
            maxImageDimension: 1024,
          }),
        );
        actionable = { window: candidates[0], state };
      }

      if (!actionable) throw new Error("failed to snapshot any candidate window");

      const { window: targetWindow, state } = actionable;
      const elements = state.elements ?? [];
      const labels = elements
        .map((e) => e.label || e.role || "?")
        .filter(Boolean)
        .slice(0, 8);
      const { images, ...rest } = state;
      await writeFile(
        join(outDir, "window-state.json"),
        jsonSafe({
          app: targetWindow.appName,
          title: targetWindow.title,
          pid: targetWindow.pid,
          windowId: targetWindow.windowId.toString(),
          ...rest,
          elements: elements.slice(0, 40),
          imageCount: images?.length ?? 0,
          hasScreenshot: Boolean(images?.[0]),
          pickAttempts: attempts,
        }),
      );
      if (images?.length) await saveScreenshot(images, "window.png");

      const axReady = !state.degraded && elements.length > 0;
      return `${targetWindow.appName}:${targetWindow.title || "untitled"} axReady=${axReady} elements=${elements.length} degraded=${state.degraded} | ${labels.join(", ")}`;
    });

    if (interact) {
      console.log("\n--interact: exercising input / clipboard\n");

      await probe("moveCursor(desktop center-ish)", async () => {
        const result = await driver.moveCursor(
          MoveCursorInput.new({
            x: 300,
            y: 300,
            session: SESSION,
            target: new ActionTarget.Desktop({ displayId: "primary" }),
          }),
        );
        return summarizeToolResult(result);
      });

      await probe("clipboardWrite + clipboardRead", async () => {
        const marker = `cua-driver-probe-${Date.now()}`;
        const write = await driver.clipboardWrite(
          ClipboardWriteInput.new({ text: marker, session: SESSION }),
        );
        if (write.isError) {
          throw new Error(write.text || write.errorCode || "clipboard write failed");
        }
        const read = await driver.clipboardRead(
          ClipboardReadInput.new({ includeText: true, session: SESSION }),
        );
        if (read.isError) {
          throw new Error(read.text || read.errorCode || "clipboard read failed");
        }
        const text =
          read.structuredJson &&
          (() => {
            try {
              return JSON.parse(read.structuredJson).text;
            } catch {
              return undefined;
            }
          })();
        const matched =
          text === marker ||
          read.text?.includes(marker) ||
          read.rawJson?.includes(marker);
        if (!matched) {
          throw new Error(
            `clipboard round-trip mismatch (got text=${JSON.stringify(text ?? read.text)})`,
          );
        }
        return `wrote+read marker (${marker.slice(0, 24)}…)`;
      });

      const targetWindow = actionable?.window;
      const axReady =
        actionable?.state &&
        !actionable.state.degraded &&
        (actionable.state.elements?.length ?? 0) > 0;

      if (targetWindow?.pid != null) {
        // Refresh snapshot right before input; stale/off-space windows refuse Background.
        await probe("refresh window snapshot before input", async () => {
          const state = await driver.getWindowState(
            GetWindowStateInput.new({
              pid: targetWindow.pid,
              windowId: targetWindow.windowId,
              session: SESSION,
              includeAccessibilityTree: true,
              includeScreenshot: false,
              maxElements: 20,
              maxDepth: 6,
            }),
          );
          actionable = { window: targetWindow, state };
          return `elements=${state.elements?.length ?? 0} degraded=${state.degraded} reason=${state.degradedReason ?? "-"}`;
        });

        await probe("bring_to_front (callTool)", async () => {
          const result = await driver.callTool(
            "bring_to_front",
            JSON.stringify({
              pid: targetWindow.pid,
              window_id: Number(targetWindow.windowId),
              session: SESSION,
            }),
          );
          return summarizeToolResult(result);
        });

        await probe("click(window, Foreground)", async () => {
          // Background refuses windows whose AX surface is unresolved / off-Space
          // (error: off_space_or_ax_unresolved). Foreground is the portable probe path.
          const fresh = actionable?.state?.elements ?? [];
          const tokenEl = fresh.find((e) => e.elementToken && e.enabled !== false);
          const position = tokenEl?.elementToken
            ? new ClickPosition.Element({ elementToken: tokenEl.elementToken })
            : new ClickPosition.Coordinates({ x: 40, y: 40 });

          try {
            const action = await driver.click(
              ClickInput.new({
                target: new ActionTarget.Window({
                  pid: targetWindow.pid,
                  windowId: targetWindow.windowId,
                }),
                position,
                deliveryMode: InputDeliveryMode.Foreground,
                button: ClickButton.Left,
                count: 1,
                session: SESSION,
              }),
            );
            return `target=window via=${tokenEl ? "element" : "coords"} action=${jsonSafe(action).replace(/\s+/g, " ").slice(0, 140)}`;
          } catch (windowErr) {
            // Last resort: desktop coordinate click still proves input delivery works.
            const action = await driver.click(
              ClickInput.new({
                target: new ActionTarget.Desktop({ displayId: "primary" }),
                position: new ClickPosition.Coordinates({ x: 300, y: 300 }),
                deliveryMode: InputDeliveryMode.Foreground,
                button: ClickButton.Left,
                count: 1,
                session: SESSION,
              }),
            );
            return `target=desktop(fallback after ${formatError(windowErr).slice(0, 80)}) action=${jsonSafe(action).replace(/\s+/g, " ").slice(0, 100)}`;
          }
        });

        await probe("typeText(empty, desktop target)", async () => {
          // Window-targeted typeText also uses the background route and refuses
          // unresolved AXWindows. Desktop target exercises the input path safely.
          const result = await driver.typeText(
            TypeTextInput.new({
              text: "",
              session: SESSION,
              target: new ActionTarget.Desktop({ displayId: "primary" }),
            }),
          );
          return summarizeToolResult(result) + " (empty — no side effect)";
        });
      } else {
        fail("click/typeText", "no actionable window for input probes");
      }
    } else {
      console.log(
        "\n(skipping moveCursor / clipboard / click / type — pass --interact to enable)\n",
      );
    }

    await probe("endSession()", async () => {
      const out = await driver.endSession(
        EndSessionInput.new({ session: SESSION }),
      );
      return jsonSafe(out).replace(/\s+/g, " ").slice(0, 120);
    });
  } finally {
    await probe("shutdown()", async () => {
      await driver.shutdown();
      return "ok";
    });
    if (typeof driver.uniffiDestroy === "function") {
      driver.uniffiDestroy();
    }
  }

  printSummary();
  const failed = results.filter((r) => !r.ok).length;
  process.exit(failed ? 1 : 0);
}

function printSummary() {
  const ok = results.filter((r) => r.ok).length;
  const failed = results.filter((r) => !r.ok).length;
  console.log("\n── summary ──");
  console.log(`  passed: ${ok}  failed: ${failed}  total: ${results.length}`);
  if (failed) {
    for (const r of results.filter((x) => !x.ok)) {
      console.log(`  • ${r.name}: ${r.error}`);
    }
  }
}

main().catch((err) => {
  console.error("fatal:", err);
  process.exit(1);
});
