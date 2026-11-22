import { fileURLToPath } from "node:url";
import { configDefaults, defineConfig } from "vitest/config";

const src = (pkg: string): string => fileURLToPath(new URL(`./packages/${pkg}/src/index.ts`, import.meta.url));

const alias = [
  { find: "@open-erp/metamodel", replacement: src("metamodel") },
  { find: "@open-erp/loader", replacement: src("loader") },
  { find: "@open-erp/storage-pg", replacement: src("storage-pg") },
  { find: "@open-erp/runtime-core", replacement: src("runtime-core") },
  { find: "@open-erp/tables", replacement: fileURLToPath(new URL("./tables/src/index.ts", import.meta.url)) },
];

const include = [
  "packages/*/test/**/*.test.ts",
  "domains/*/test/**/*.test.ts",
];

export default defineConfig({
  test: {
    poolOptions: {
      forks: { isolate: false },
      threads: { isolate: true },
    },
    projects: [
      {
        resolve: { alias },
        test: {
          name: "engine",
          environment: "node",
          pool: "forks",
          isolate: false,
          setupFiles: [
            fileURLToPath(new URL("./packages/metamodel/test/installProductLedgers.setup.ts", import.meta.url)),
          ],
          include,
          exclude: [
            ...configDefaults.exclude,
            "packages/builder/test/domainSwap.gate.test.ts",
          ],
        },
      },
    ],
  },
});
