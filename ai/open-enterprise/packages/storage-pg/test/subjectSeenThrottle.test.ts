import type { SubjectIdentity } from "@open-erp/runtime-core";
import { describe, expect, it } from "vitest";
import { createLocalRbacRepo, SUBJECT_SEEN_THROTTLE_MS } from "../src/repo/localRbacRepo.js";

const SUBJECT: SubjectIdentity = {
  tenantId: "tenant-a",
  orgId: "org-a",
  userId: "user-a",
  identify: "1",
  agentId: null,
};
const T0 = new Date("2026-09-16T00:00:00.000Z");

function countingExec(writes: number[], failUntil = 0) {
  return {
    update() {
      return {
        set() {
          return {
            async where() {
              writes.push(1);
              if (writes.length <= failUntil) throw new Error("pg down");
              return [];
            },
          };
        },
      };
    },
  };
}

describe("platform subject last_seen write throttle", () => {
  it("does not write the same subject inside the interval; a new org or a lapsed interval writes again", async () => {
    const writes: number[] = [];
    const repo = createLocalRbacRepo(countingExec(writes) as never, {
      managerPermissionKey: "rbac.manage",
      directoryTable: {} as never,
    });

    await repo.observe(SUBJECT, T0);
    expect(writes).toHaveLength(2);

    await repo.observe(SUBJECT, new Date(T0.getTime() + SUBJECT_SEEN_THROTTLE_MS - 1));
    expect(writes).toHaveLength(2);

    await repo.observe({ ...SUBJECT, orgId: "org-b" }, new Date(T0.getTime() + 1_000));
    expect(writes).toHaveLength(4);

    await repo.observe(SUBJECT, new Date(T0.getTime() + SUBJECT_SEEN_THROTTLE_MS));
    expect(writes).toHaveLength(6);
  });

  it("a failed write is not remembered as throttled, so the next call still writes", async () => {
    const writes: number[] = [];
    const repo = createLocalRbacRepo(countingExec(writes, 1) as never, {
      managerPermissionKey: "rbac.manage",
      directoryTable: {} as never,
    });

    await expect(repo.observe(SUBJECT, T0)).rejects.toThrow(/pg down/);
    await repo.observe(SUBJECT, T0);
    expect(writes).toHaveLength(3);
  });
});
