// ---------------------------------------------------------------------------
// block: Framework src does not recognize business module / desk account / physical word, documentation status volume, insight key.
// the documents allowed to appear are a collection; they appear outside the assembly, or red, and are numerous.
// ---------------------------------------------------------------------------

import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  scanBusinessVocabulary,
  scanExactWords,
  scanStatusLiterals,
  scenarioAndFieldVocabulary,
  statusTally,
  vocabularyTally,
} from "../src/businessVocabulary.js";

const ROOT = path.resolve(fileURLToPath(new URL("../../../", import.meta.url)));
const DOMAINS = path.join(ROOT, "domains");
const PACKAGES = path.join(ROOT, "packages");

/** Documents in the framework src that allow business words to appear. It appears outside the assembly or red; it does not count. */
const ALLOWED_VOCAB_FILES = new Set([
  "fixtures/src/shape.ts",
  "metamodel/src/derive/primitives.ts",
  "metamodel/src/normalize/ledger.ts",
  "metamodel/src/schema/effects.ts",
  "metamodel/src/validate/validate.ts",
  "server/src/authorization/authorizer.ts",
  "server/src/http/app.ts",
  "server/src/http/routes/authorization.ts",
  "server/src/http/routes/balance.ts",
  "server/src/http/routes/bills.ts",
  "server/src/http/routes/dashboard.ts",
  "server/src/http/routes/mobile.ts",
  "server/src/http/routes/notifications.ts",
  "server/src/http/routes/productArchive.ts",
  // the authorization of receiving and inspection kits to create a non-suspensible chain of production (goods, BOM, process routes, production orders, tasks) can only be named.
  "server/src/seedAuthorizationTestUsers.ts",
  "storage-pg/src/repo/localRbacRepo.ts",
]);

describe("gate: The business vocabulary in the framework is numbered", () => {
  it("🔴 Packages/ crucify by file the position where the business word is recognized -- in more than one case, someone will make a manifest decision.", async () => {
    const hits = await scanBusinessVocabulary(DOMAINS, PACKAGES);
    const extra = Object.keys(vocabularyTally(hits)).filter((file) => !ALLOWED_VOCAB_FILES.has(file)).sort();
    expect(
      extra,
      `\nA framework file contains a business word that is not in the allow-list:\n    ${extra.join("\n    ")}\n` +
        `\nThe way out is to read that text from the declaration. Add the file name to the allow-list only when there is no such way out.\n`,
    ).toEqual([]);
  }, 30_000);
});

/** A document in the frame src that allows a physical amount of documentation to appear. It appears outside the assembly or red; it does not count. */
const ALLOWED_STATUS_FILES = new Set([
  "metamodel/src/schema/notification.ts",
  "runtime-core/src/contracts/repositories.ts",
  "server/src/agent/notificationTools.ts",
  "server/src/http/routes/notifications.ts",
  "server/src/notification/engine.ts",
  "server/src/notification/rule.ts",
  "server/src/notification/worker.ts",
  "server/src/seedAuthorizationTestUsers.ts",
  "fixtures/src/devPersonas.ts",
  "fixtures/src/members.ts",
  "fixtures/src/tenant.ts",
  "storage-pg/src/repo/localRbacRepo.ts",
  "storage-pg/src/repo/userViewRepo.ts",
]);

describe("gate: Number of documents in the frame", () => {
  it("🔴 Packages/ Capturing the file 's location of the document 's status machine -- in more than one case, someone will have to make a manifest decision.", async () => {
    const hits = await scanStatusLiterals(DOMAINS, PACKAGES);
    const extra = Object.keys(statusTally(hits)).filter((file) => !ALLOWED_STATUS_FILES.has(file)).sort();
    expect(
      extra,
      `\nA framework file contains a document-status literal that is not in the allow-list:\n    ${extra.join("\n    ")}\n` +
        `\nThe vocabulary is derived from each module's lifecycle.statuses.key. Read it from the module declaration.\n`,
    ).toEqual([]);
  }, 30_000);
});

/** File in frame src allows the catalog.insights key to appear. Current is empty: any hit is red. */
const ALLOWED_SCENARIO_FILES = new Set<string>();

describe("gate: Business scene in the frame id", () => {
  it("🔴 packages/ crucify the catalog.insights key", async () => {
    const { scenarios } = await scenarioAndFieldVocabulary(DOMAINS, PACKAGES);
    const hits = await scanExactWords(PACKAGES, scenarios);
    const extra = Object.keys(statusTally(hits)).filter((file) => !ALLOWED_SCENARIO_FILES.has(file)).sort();
    expect(extra, `\nA framework file contains an insight key that is not in the allow-list:\n    ${extra.join("\n    ")}\n`).toEqual([]);
  }, 30_000);
});
