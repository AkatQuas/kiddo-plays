// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import path from "node:path";
import { occupancyAuditBlocksRemoval } from "@open-erp/metamodel";
import { describe, expect, it } from "vitest";

const REPO = path.resolve(process.cwd(), "packages/storage-pg/src/repo/billRepo.ts");

describe("removal check for occupancy retired", () => {
  it("an occupancy-edge audit does not count as a required trace; a non-occupancy edge such as activate must remain", () => {
    expect(occupancyAuditBlocksRemoval("retired", "disable")).toBe(false);
    expect(occupancyAuditBlocksRemoval("retired", "enable")).toBe(false);
    expect(occupancyAuditBlocksRemoval("retired", "activate")).toBe(true);
    expect(occupancyAuditBlocksRemoval("retired", "")).toBe(true);
    expect(occupancyAuditBlocksRemoval("none", "submit")).toBe(true);
    expect(occupancyAuditBlocksRemoval("in-use", "disable")).toBe(true);
  });

  it("assertRemovable filters the audit by the occupancy convention, and does not branch on module code", () => {
    const source = readFileSync(REPO, "utf8");
    expect(source).toContain("occupancyOf");
    expect(source).toContain("occupancyAuditBlocksRemoval");
    expect(source).not.toMatch(/module === ["']supplier["']/);
    expect(source).not.toMatch(/module === ["']product["']/);
  });
});
