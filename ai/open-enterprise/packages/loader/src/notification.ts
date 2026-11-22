import path from "node:path";
import { defineNotificationPresets, type NotificationPresetSchema } from "@open-erp/metamodel";
import { fail } from "./errors.js";
import { exists, importExports } from "./filesystem.js";

export interface LoadedNotificationPreset extends NotificationPresetSchema {
  readonly domain: string;
  readonly file: string;
}

/**
 * Domain-level `notifications.ts`: same shape as `surfaces.ts` / `authorization.ts`. If the file exists, it is registered.
 *
 * The declaration is the seed, and the table is the tenant's source of truth. What is read here is the product baseline; the seed semantics
 * "write only when the code is missing, and do not overwrite a configuration the tenant already changed" are fulfilled in the server's presets.ts.
 */
export async function loadDomainNotifications(
  domainDirectory: string,
  domain: string,
  domainsRoot: string,
): Promise<readonly LoadedNotificationPreset[]> {
  const source = ["notifications.ts", "notifications.js"]
    .map((name) => path.join(domainDirectory, name))
    .find((file) => exists(file));
  if (!source) return [];
  const loaded = await importExports(source);
  const relative = path.relative(domainsRoot, source);
  const raw = loaded["default"] ?? loaded["notifications"];
  if (raw === undefined) {
    fail(
      `${relative} has no default export — it must be \`export default defineNotificationPresets([...])\``,
    );
  }
  const unknown = Object.keys(loaded).filter((key) => key !== "notifications" && key !== "default");
  if (unknown.length) {
    fail(`${relative} has unknown named exports "${unknown.join(", ")}" — only notifications is allowed`);
  }
  // A mistake in development fails fast: shipping a bad configuration shows up as "that notification is never sent", and nobody goes looking.
  const presets = defineNotificationPresets(raw, relative);
  return presets.map((preset) => ({ ...preset, domain, file: relative }));
}

/** Merge across domains. `code` is the unique identity for the whole product, and a clash must say which two domains collided. */
export function mergeNotificationPresets(
  batches: readonly (readonly LoadedNotificationPreset[])[],
): readonly LoadedNotificationPreset[] {
  const byCode = new Map<string, LoadedNotificationPreset>();
  for (const batch of batches) {
    for (const preset of batch) {
      const previous = byCode.get(preset.code);
      if (previous) {
        fail(
          `notification preset "${preset.code}" is declared twice: ${previous.file} and ${preset.file} — code is globally unique across the whole product`,
        );
      }
      byCode.set(preset.code, preset);
    }
  }
  return [...byCode.values()];
}
