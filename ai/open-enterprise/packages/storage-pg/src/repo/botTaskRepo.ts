import { createHash, randomUUID } from "node:crypto";
import { and, eq, inArray, lte, or, isNull, sql, desc } from "drizzle-orm";
import { requireIdentity, type Identity } from "@open-erp/runtime-core";
import { botSubscription, botDispatch, botResult, notificationMessage } from "../db/framework.js";
import { scopedWhere, scopedValues } from "../db/scope.js";
import type { Executor } from "./support.js";
import type { ChangeEventRow } from "./changeEventRepo.js";
export class BotTaskError extends Error {
    constructor(readonly status: 400 | 403 | 404 | 409, message: string) { super(message); }
}
const hash = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
export const botAuthorizationFingerprint = (who: Identity) => hash({ permissions: [...who.permissions].sort(), dataScopes: who.dataScopes, applicationId: who.authorization.applicationId, catalogDigest: who.authorization.catalogDigest });
export const BOT_SUBSCRIPTION_ENABLED = "active";
export type BotSubscriptionInput = {
    subscriptionRef: string;
    botId: string;
    taskId: string;
    bindingRevision: number;
    trigger: "event" | "cron";
    business: {
        module: string;
        events: readonly string[];
    };
    eventSecret: string | null;
};
export type BotResultInput = {
    subscriptionRef: string;
    runId: string;
    taskId: string;
    workSessionId: string;
    status: string;
    result: string;
};
export function createBotTaskRepo(exec: Executor) {
    const owned = (identity: Identity) => { const who = requireIdentity(identity); return scopedWhere(botSubscription, who, eq(botSubscription.ownerId, who.userId)); };
    return {
        async list(identity: Identity) { return await exec.select().from(botSubscription).where(owned(identity)); },
        async get(identity: Identity, id: string) { return (await exec.select().from(botSubscription).where(and(owned(identity), eq(botSubscription.id, id))))[0] ?? null; },
        async activate(identity: Identity, input: BotSubscriptionInput, at: Date) {
            const who = requireIdentity(identity);
            if (!who.agentId)
                throw Error("Subscription registration is missing the business-assistant identity.");
            if (who.identify !== "0" && who.identify !== "1")
                throw Error("Subscription registration is missing a personal or company identity.");
            const fingerprint = hash(input);
            await exec.insert(botSubscription).values(scopedValues(who, { id: input.subscriptionRef, ownerId: who.userId, botId: input.botId, taskId: input.taskId, agentId: who.agentId, bindingRevision: input.bindingRevision, revision: 1, status: "active", module: input.business.module, trigger: input.trigger, events: [...input.business.events], eventSecret: input.eventSecret, fingerprint, identify: who.identify, authorizationFingerprint: botAuthorizationFingerprint(who), createdAt: at })).onConflictDoNothing();
            const row = (await exec.select().from(botSubscription).where(and(owned(who), eq(botSubscription.id, input.subscriptionRef))))[0];
            if (!row || row.fingerprint !== fingerprint)
                throw new BotTaskError(409, "This subscription id already exists and the configuration does not match.");
            if (row.status !== "active")
                throw new BotTaskError(409, "This subscription is already stopped. Create a new task.");
            return row;
        },
        async pause(identity: Identity, id: string) { return (await exec.update(botSubscription).set({ status: "paused", revision: sql `${botSubscription.revision}+1` }).where(and(owned(identity), eq(botSubscription.id, id))).returning())[0] ?? null; },
        async dispatches(identity: Identity) {
            const who = requireIdentity(identity);
            return await exec.select({ id: botDispatch.id, subscriptionRef: botDispatch.subscriptionId, status: botDispatch.status, attempts: botDispatch.attempts, lastError: botDispatch.lastError, sessionId: botDispatch.sessionId }).from(botDispatch).innerJoin(botSubscription, and(eq(botDispatch.subscriptionId, botSubscription.id), eq(botDispatch.tenantId, botSubscription.tenantId))).where(scopedWhere(botSubscription, who, eq(botSubscription.ownerId, who.userId))).orderBy(desc(botDispatch.availableAt)).limit(100);
        },
        async results(identity: Identity) { const who = requireIdentity(identity); return await exec.select().from(botResult).where(scopedWhere(botResult, who, eq(botResult.ownerId, who.userId))).orderBy(desc(botResult.createdAt)).limit(100); },
        async result(identity: Identity, id: string) { const who = requireIdentity(identity); return (await exec.select().from(botResult).where(scopedWhere(botResult, who, eq(botResult.ownerId, who.userId), eq(botResult.id, id))))[0] ?? null; },
        async receive(identity: Identity, input: BotResultInput, at: Date) {
            const who = requireIdentity(identity);
            return await exec.transaction(async (tx) => {
                const sub = (await tx.select().from(botSubscription).where(and(owned(who), eq(botSubscription.id, input.subscriptionRef))).for("update"))[0];
                if (!sub || sub.status !== "active" || sub.taskId !== input.taskId || sub.agentId !== who.agentId)
                    throw new BotTaskError(409, "The subscription does not exist, is stopped, or does not belong to this task.");
                const id = hash([who.tenantId, who.userId, input.subscriptionRef, input.runId]), fingerprint = hash(input);
                const existing = (await tx.select().from(botResult).where(scopedWhere(botResult, who, eq(botResult.id, id))))[0];
                if (existing) {
                    if (existing.fingerprint !== fingerprint)
                        throw new BotTaskError(409, "The result of the same run does not match. Refusing to overwrite it.");
                    return existing;
                }
                const value = scopedValues(who, { id, ownerId: who.userId, subscriptionId: sub.id, runId: input.runId, payload: input, fingerprint, createdAt: at });
                await tx.insert(botResult).values(value);
                await tx.insert(notificationMessage).values(scopedValues(who, { id: randomUUID(), recipientUserId: sub.ownerId, title: input.status === "success" ? "Business-assistant task completed" : "Business-assistant task failed", body: input.result.slice(0, 4000), link: "/bot-tasks?result=" + id, type: "system", source: "auto", ruleId: null, runId: input.runId, sourceModule: null, sourceBillId: null, payload: { kind: "bot-result", resultId: id }, dedupeKey: "bot:" + id, createdAt: at }));
                return value;
            });
        },
        // The queue is an internal platform mechanism and claims across tenants; the network call stays outside the transaction, and each row rechecks the owner it already stored.
        async claim(at: Date) {
            return await exec.transaction(async (tx) => {
                const rows = await tx.select().from(botDispatch).where(and(inArray(botDispatch.status, ["pending", "retry"]), lte(botDispatch.availableAt, at), or(isNull(botDispatch.leaseUntil), lte(botDispatch.leaseUntil, at)))).limit(20).for("update", { skipLocked: true });
                const result = [];
                for (const row of rows) {
                    const token = randomUUID();
                    await tx.update(botDispatch).set({ leaseToken: token, leaseUntil: new Date(at.getTime() + 60000), attempts: row.attempts + 1 }).where(eq(botDispatch.id, row.id));
                    const sub = (await tx.select().from(botSubscription).where(and(eq(botSubscription.id, row.subscriptionId), eq(botSubscription.tenantId, row.tenantId))))[0];
                    if (!sub)
                        throw Error("The subscription referenced by this dispatch is gone.");
                    result.push({ ...row, leaseToken: token, attempts: row.attempts + 1, subscription: sub });
                }
                return result;
            });
        },
        async settle(id: string, token: string, status: "accepted" | "retry" | "stopped", at: Date, error: string | null, sessionId: string | null) {
            const result = await exec.update(botDispatch).set({ status, availableAt: at, lastError: error, sessionId, leaseToken: null, leaseUntil: null }).where(and(eq(botDispatch.id, id), eq(botDispatch.leaseToken, token))).returning({ id: botDispatch.id });
            if (result.length !== 1)
                throw Error("The dispatch lease has changed.");
        },
    };
}
/** Same transaction as confirming event consumption. On failure the event is not confirmed and a half-written dispatch is not left behind. */
export async function stageBotDispatches(tx: Executor, events: readonly ChangeEventRow[], at: Date) {
    for (const event of events) {
        const subs = await tx.select().from(botSubscription).where(and(eq(botSubscription.tenantId, event.tenantId), eq(botSubscription.module, event.module), eq(botSubscription.trigger, "event"), eq(botSubscription.status, "active"), lte(botSubscription.createdAt, event.at)));
        for (const sub of subs) {
            if (!Array.isArray(sub.events) || !sub.events.includes(event.kind))
                continue;
            const id = hash([sub.id, event.id]);
            // Do not copy the document body, a delete snapshot, or amounts; before execution, look up again with the owner's current permissions.
            await tx.insert(botDispatch).values({ id, subscriptionId: sub.id, tenantId: event.tenantId, orgId: event.orgId, event: { id: event.id, module: event.module, billId: event.billId, kind: event.kind, at: event.at.toISOString() }, status: "pending", attempts: 0, availableAt: at }).onConflictDoNothing();
        }
    }
}
export type BotTaskRepo = ReturnType<typeof createBotTaskRepo>;
