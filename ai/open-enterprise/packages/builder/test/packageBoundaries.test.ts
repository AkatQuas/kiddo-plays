import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import { listTsFiles, parsedSourceOf } from "../src/sourceFiles.js";

const ROOT = path.resolve(fileURLToPath(new URL("../../../", import.meta.url)));

interface ImportSite {
  readonly file: string;
  readonly specifier: string;
  readonly typeOnly: boolean;
}

function tsFiles(directory: string): readonly string[] {
  return [...listTsFiles(directory)].sort();
}

function importsOf(file: string): readonly ImportSite[] {
  const { sourceFile } = parsedSourceOf(file);
  const imports: ImportSite[] = [];
  const add = (specifier: ts.Expression, typeOnly: boolean): void => {
    if (ts.isStringLiteralLike(specifier)) {
      imports.push({ file: path.relative(ROOT, file), specifier: specifier.text, typeOnly });
    }
  };
  const visit = (node: ts.Node): void => {
    if (ts.isImportDeclaration(node)) add(node.moduleSpecifier, node.importClause?.isTypeOnly === true);
    else if (ts.isExportDeclaration(node) && node.moduleSpecifier) add(node.moduleSpecifier, node.isTypeOnly);
    else if (
      ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.ImportKeyword &&
      node.arguments.length === 1
    ) {
      const argument = node.arguments[0];
      if (argument) add(argument, false);
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return imports;
}

function workspaceImport(specifier: string): string | null {
  const match = /^@open-erp\/([^/]+)(?:\/(.+))?$/.exec(specifier);
  if (!match) return null;
  const workspace = match[1];
  if (!workspace) return null;
  return workspace;
}

const PACKAGE_RULES = {
  metamodel: [],
  loader: ["metamodel"],
  "runtime-core": ["metamodel"],
  "storage-pg": ["metamodel", "runtime-core", "tables"],
  builder: ["loader", "metamodel"],
  server: ["builder", "loader", "metamodel", "runtime-core", "storage-pg", "tables"],
  fixtures: ["loader", "metamodel", "server", "storage-pg"],
} as const;

/** Framework packages live in `packages/<name>`. Non-product fixtures live at the repo-root `fixtures/`. */
const packageDir = (name: string): string => (name === "fixtures" ? "fixtures" : `packages/${name}`);

/** This tree publishes the engine and domain showcase. The HTTP shell and fixture loader are absent. */
const PRESENT_RULES = Object.fromEntries(
  Object.entries(PACKAGE_RULES).filter(([name]) => existsSync(path.join(ROOT, packageDir(name), "package.json"))),
) as { [Name in keyof typeof PACKAGE_RULES]?: readonly string[] };

const SINGLE_OWNER_DECLARATIONS = [
  ["class RepoError", "packages/runtime-core/src/contracts/errors.ts", /export class RepoError\b/],
  ["class BillInvalidError", "packages/runtime-core/src/contracts/errors.ts", /export class BillInvalidError\b/],
  ["class BalanceArgumentError", "packages/runtime-core/src/contracts/errors.ts", /export class BalanceArgumentError\b/],
  ["class LedgerConstraintError", "packages/runtime-core/src/contracts/errors.ts", /export class LedgerConstraintError\b/],
  ["interface Identity", "packages/runtime-core/src/contracts/identity.ts", /export interface Identity\b/],
  ["ATTACHMENT_KEY_PREFIX", "packages/runtime-core/src/contracts/objectOwnership.ts", /export const ATTACHMENT_KEY_PREFIX\b/],
  ["warningConfirmationToken", "packages/runtime-core/src/contracts/warningToken.ts", /export function warningConfirmationToken\b/],
  ["interface AgentAuditEntry", "packages/runtime-core/src/contracts/agent.ts", /export interface AgentAuditEntry\b/],
  ["interface AgentAuditSink", "packages/runtime-core/src/contracts/agent.ts", /export interface AgentAuditSink\b/],
  ["interface TenantSkillRecord", "packages/runtime-core/src/contracts/agent.ts", /export interface TenantSkillRecord\b/],
  ["createDb", "packages/storage-pg/src/db/client.ts", /export function createDb\b/],
  ["schemasOf", "packages/storage-pg/src/repo/support.ts", /export function schemasOf\b/],
  ["createExecutionRepos", "packages/storage-pg/src/repo/index.ts", /export function createExecutionRepos\b/],
] as const;

describe("gate: Workspace Physical Dependence Direction", () => {
  it.each(Object.entries(PRESENT_RULES))("@open-erp/%s depends only on the allowed downstream packages", (name, allowed) => {
    const imports = tsFiles(path.join(ROOT, packageDir(name), "src")).flatMap(importsOf);
    const sourceViolations = imports
      .filter(({ specifier }) => {
        const dependency = workspaceImport(specifier);
        return dependency !== null && !(allowed as readonly string[]).includes(dependency);
      })
      .map(({ file, specifier }) => `${file} -> ${specifier}`);
    const manifest = JSON.parse(readFileSync(path.join(ROOT, packageDir(name), "package.json"), "utf8")) as {
      readonly dependencies?: Readonly<Record<string, string>>;
    };
    const declared = Object.keys(manifest.dependencies ?? {})
      .map(workspaceImport)
      .filter((dependency): dependency is string => dependency !== null);
    const manifestViolations = declared
      .filter((dependency) => !(allowed as readonly string[]).includes(dependency))
      .map((dependency) => `${packageDir(name)}/package.json -> @open-erp/${dependency}`);
    const missingDeclarations = [...new Set(imports.map(({ specifier }) => workspaceImport(specifier)).filter(
      (dependency): dependency is string => dependency !== null,
    ))]
      .filter((dependency) => !declared.includes(dependency))
      .map((dependency) => `${packageDir(name)}/package.json is missing @open-erp/${dependency}`);
    const violations = [...sourceViolations, ...manifestViolations, ...missingDeclarations];
    expect(violations, `\n${violations.join("\n")}\n`).toEqual([]);
  });

  it("only pack size root without penetrating the internal directory of another package", () => {
    const imports = Object.keys(PRESENT_RULES)
      .flatMap((name) => tsFiles(path.join(ROOT, packageDir(name), "src")))
      .flatMap(importsOf);
    const deepImports = imports
      .filter(({ specifier }) => /^@open-erp\/[^/]+\//.test(specifier))
      .map(({ file, specifier }) => `${file} -> ${specifier}`);
    expect(deepImports, `\n${deepImports.join("\n")}\n`).toEqual([]);
  });

  it("metamodel maintains zero IO; runtime-core without contact with file system, network, HTTP or database driver", () => {
    const metamodel = tsFiles(path.join(ROOT, "packages/metamodel/src")).flatMap(importsOf);
    const runtime = tsFiles(path.join(ROOT, "packages/runtime-core/src")).flatMap(importsOf);
    const metamodelIo = metamodel
      .filter(({ specifier }) => specifier.startsWith("node:") || /^(?:drizzle-orm|postgres|hono)(?:\/|$)/.test(specifier))
      .map(({ file, specifier }) => `${file} -> ${specifier}`);
    const runtimeIo = runtime
      .filter(({ specifier }) => /^(?:node:(?:fs|fs\/promises|net|http|https)|drizzle-orm|postgres|hono)(?:\/|$)/.test(specifier))
      .map(({ file, specifier }) => `${file} -> ${specifier}`);
    expect(metamodelIo, `\n${metamodelIo.join("\n")}\n`).toEqual([]);
    expect(runtimeIo, `\n${runtimeIo.join("\n")}\n`).toEqual([]);
  });

  // The product does not know about fixtures. domains/** (including tests) and product package src must not import them. Only packages/**/test and packages/server/e2e may import fixtures.
  it("domain declared reliance only on metamode; product source code and domains (including testing) not quoted", () => {
    const violations: string[] = [];
    const domainsRoot = path.join(ROOT, "domains");
    for (const domain of readdirSync(domainsRoot, { withFileTypes: true }).filter((entry) => entry.isDirectory())) {
      const root = path.join(domainsRoot, domain.name);
      if (existsSync(path.join(root, "seed.ts"))) violations.push(`domains/${domain.name}/seed.ts`);
      const declarationFiles = [path.join(root, "domain.ts"), ...tsFiles(path.join(root, "modules"))];
      for (const site of declarationFiles.filter(existsSync).flatMap(importsOf)) {
        const dependency = workspaceImport(site.specifier);
        if (dependency !== null && dependency !== "metamodel") violations.push(`${site.file} -> ${site.specifier}`);
      }
    }
    const productSources = Object.keys(PRESENT_RULES)
      .filter((name) => name !== "fixtures")
      .flatMap((name) => tsFiles(path.join(ROOT, "packages", name, "src")));
    for (const site of [...productSources, ...tsFiles(domainsRoot)].flatMap(importsOf)) {
      if (site.specifier === "@open-erp/fixtures" || site.specifier.startsWith("@open-erp/fixtures/")) {
        violations.push(`${site.file} -> ${site.specifier}`);
      }
    }
    for (const domain of readdirSync(domainsRoot, { withFileTypes: true }).filter((entry) => entry.isDirectory())) {
      for (const manifest of ["tsconfig.json", "package.json"]) {
        const file = path.join(domainsRoot, domain.name, manifest);
        if (existsSync(file) && /fixtures/.test(readFileSync(file, "utf8"))) violations.push(`domains/${domain.name}/${manifest} imports fixtures`);
      }
    }
    expect(violations, `\n${violations.join("\n")}\n`).toEqual([]);
  });
});

describe("gate: Public contracts kept only", () => {
  it("server does not do compatible forwarding for runtime-core/storage-pg", () => {
    const serverSrc = path.join(ROOT, "packages/server/src");
    if (!existsSync(serverSrc)) return;
    const forwards = tsFiles(serverSrc)
      .flatMap((file) => {
        const { sourceFile } = parsedSourceOf(file);
        return sourceFile.statements
          .filter(ts.isExportDeclaration)
          .filter((statement) => statement.moduleSpecifier && ts.isStringLiteralLike(statement.moduleSpecifier))
          .map((statement) => ({
            file: path.relative(ROOT, file),
            specifier: (statement.moduleSpecifier as ts.StringLiteralLike).text,
          }));
      })
      .filter(({ specifier }) => specifier === "@open-erp/runtime-core" || specifier === "@open-erp/storage-pg")
      .map(({ file, specifier }) => `${file} -> ${specifier}`);
    expect(forwards, `\n${forwards.join("\n")}\n`).toEqual([]);
  });

  it("HTTP Runtime does not expose naked DB, source-pg does not keep the second repo factory or famework sub-entry", () => {
    const contextPath = path.join(ROOT, "packages/server/src/http/context.ts");
    const context = existsSync(contextPath) ? parsedSourceOf(contextPath).source : "";
    const repoAssembly = parsedSourceOf(path.join(ROOT, "packages/storage-pg/src/repo/index.ts")).source;
    const storageManifest = readFileSync(path.join(ROOT, "packages/storage-pg/package.json"), "utf8");
    expect(context).not.toMatch(/readonly\s+db\s*:/);
    expect(repoAssembly).not.toMatch(/export function createRepos\b/);
    expect(storageManifest).not.toContain('"./framework"');
  });

  it.each(SINGLE_OWNER_DECLARATIONS)("%s has a single implementation in the canonical place", (_label, owner, declaration) => {
    const matches = Object.keys(PRESENT_RULES)
      .flatMap((name) => tsFiles(path.join(ROOT, packageDir(name), "src")))
      .filter((file) => declaration.test(parsedSourceOf(file).source))
      .map((file) => path.relative(ROOT, file));
    expect(matches).toEqual([owner]);
  });
});
