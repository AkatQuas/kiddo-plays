// ---------------------------------------------------------------------------
// Load the repo-root `navigation.ts`
//
// Same rule as `flows/` and `quick-asks/`: the maintainer is product, not development, so it does not live under domains/.
// The loader runs defineNavigation again and does not trust the imported value.
// ---------------------------------------------------------------------------

import {
  defineNavigation,
  resolveNavigation,
  surfaceNavCode,
  validateNavigation,
  type NavigationGroup,
  type PathSurface,
} from "@open-erp/metamodel";
import type { LoadedModule } from "./catalog.js";
import { fail } from "./errors.js";
import { exists, importDefault } from "./filesystem.js";
import type { LoadedSurface } from "./surface.js";

function pathSurfacesOf(surfaces: ReadonlyMap<string, LoadedSurface>): Map<string, PathSurface> {
  const out = new Map<string, PathSurface>();
  for (const surface of surfaces.values()) {
    if (surface.path === null) continue;
    const navCode = surfaceNavCode(surface.path);
    const info: PathSurface = {
      code: surface.code,
      navCode,
      label: surface.label,
      path: surface.path,
      permission: surface.permission,
    };
    out.set(navCode, info);
    out.set(surface.code, info);
  }
  return out;
}

/**
 * Returns null when the file does not exist. `loadCatalog` calls `requireNavigationFile` first, and a synthetic fixture root must carry this declaration too.
 */
export async function loadNavigation(
  file: string,
  modules: ReadonlyMap<string, LoadedModule>,
  surfaces: ReadonlyMap<string, LoadedSurface>,
): Promise<readonly NavigationGroup[] | null> {
  if (!exists(file)) return null;
  const relative = "navigation.ts";
  let declared;
  try {
    declared = defineNavigation(await importDefault(file));
  } catch (cause) {
    fail(`${relative}: ${cause instanceof Error ? cause.message : String(cause)}`);
  }
  const pathSurfaces = pathSurfacesOf(surfaces);
  try {
    validateNavigation(declared, {
      moduleCodes: new Set(modules.keys()),
      pathSurfaces,
    });
  } catch (cause) {
    fail(`${relative}: ${cause instanceof Error ? cause.message : String(cause)}`);
  }
  try {
    return resolveNavigation(declared, {
      // `compositeChild` is the only source of truth for `within`: which parent document a child hangs under is said by the schema, not by the navigation declaration.
      modules: new Map([...modules].map(([code, loaded]) => [code, {
        label: loaded.schema.label,
        compositeChild: loaded.schema.views.composite?.child ?? null,
      }])),
      pathSurfaces,
    });
  } catch (cause) {
    fail(`${relative}: ${cause instanceof Error ? cause.message : String(cause)}`);
  }
}

export function requireNavigationFile(file: string): void {
  if (exists(file)) return;
  fail(
    `navigation declaration not found at ${file} — business-facing groups exist only in this one file. ` +
      `Every module must be written into the tree; an entry with no place in the menu uses hidden: true. Silent grouping by domain is forbidden`,
  );
}
