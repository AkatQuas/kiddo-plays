import { eq } from 'drizzle-orm';
import { HumanActionError, requireIdentity, type HumanActionRepo, type Identity } from '@open-erp/runtime-core';
import { humanAction } from '../db/framework.js';
import { scopedWhere, scopedValues } from '../db/scope.js';
import type { Executor } from './support.js';
export function createHumanActionRepo(exec: Executor): HumanActionRepo {
    const owned = (who: Identity, ...extra: Parameters<typeof scopedWhere>[2][]) => {
        requireIdentity(who);
        return scopedWhere(humanAction, who, eq(humanAction.orgId, who.orgId), eq(humanAction.ownerId, who.userId), eq(humanAction.identify, who.identify), ...extra);
    };
    return {
        async create(who, row) {
            const inserted = await exec.insert(humanAction).values(scopedValues(who, { ...row, ownerId: who.userId, identify: who.identify })).onConflictDoNothing().returning();
            const result = inserted[0] ?? (await exec.select().from(humanAction).where(owned(who, eq(humanAction.operationRef, row.operationRef))))[0];
            if (!result)
                throw new HumanActionError('ACTION_UNAVAILABLE', 503, 'The operation waiting for confirmation cannot be read right now.');
            if (result.contentHash !== row.contentHash)
                throw new HumanActionError('ACTION_OPERATION_CONFLICT', 409, 'This operation id already belongs to different content. Check it again.');
            return result;
        },
        async get(who, id, lock = false) {
            const query = exec.select().from(humanAction).where(owned(who, eq(humanAction.id, id)));
            return (await (lock ? query.for('update') : query))[0] ?? null;
        },
        async replace(who, before, after) {
            const result = await exec.update(humanAction).set({ revision: after.revision, contentHash: after.contentHash, content: after.content, reviewToken: after.reviewToken, status: after.status, receipt: after.receipt, expiresAt: after.expiresAt, updatedAt: after.updatedAt }).where(owned(who, eq(humanAction.id, before.id), eq(humanAction.revision, before.revision), eq(humanAction.status, before.status))).returning();
            if (!result[0])
                throw new HumanActionError('ACTION_CHANGED', 409, 'This operation was updated. Review it again before confirming.');
            return result[0];
        }
    };
}
