import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { SchemaError } from '@open-erp/metamodel';
import { createBill, saveDraft, readAtRevision, executeTransition, type RuntimeDeps } from '../execute/execute.js';
import { executePlannedTransition } from './planner.js';
import { HUMAN_ACTION_STATUS, HumanActionError, type HumanAction, type HumanActionContent, type HumanActionRepo } from '../contracts/humanAction.js';
import type { Identity } from '../contracts/identity.js';
function canonical(value: unknown): unknown {
    if (Array.isArray(value))
        return value.map(canonical);
    if (value !== null && typeof value === 'object')
        return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([k, v]) => [k, canonical(v)]));
    return value;
}
export const actionContentHash = (content: HumanActionContent) => createHash('sha256').update(JSON.stringify(canonical(content))).digest('hex');
function repo(deps: RuntimeDeps): HumanActionRepo { if (!deps.repos.humanActions)
    throw new HumanActionError('ACTION_UNAVAILABLE', 503, 'This deployment is not ready to store human confirmations'); return deps.repos.humanActions; }
/** Same runtime and authorizer as the human surface; the entry does not judge status and field permission a second time. */
export async function authorizeHumanAction(deps: RuntimeDeps, who: Identity, content: HumanActionContent) {
    const schema = deps.catalog.modules.get(content.module)?.schema;
    if (!schema)
        throw new SchemaError('Business module does not exist');
    if (schema.views.composite !== null)
        throw new HumanActionError('ACTION_FORM_UNSUPPORTED', 400, 'This record needs a dedicated composite form; handle it on the business page');
    deps.authorizer.assertModule(who, content.module, 'read');
    if (content.operation === 'transition') {
        if (!content.transition || !content.billId) throw new SchemaError('Business action is incomplete');
        deps.authorizer.assertTransition(who, content.module, content.transition.code);
        await readAtRevision(content.module, content.billId, content.expectedRevision, () => deps.repos.bills.get(who, content.module, content.billId!));
        return;
    }
    deps.authorizer.assertModule(who, content.module, content.operation === 'create' ? 'create' : 'update');
    deps.authorizer.assertWritePayload(who, content.module, content.header, content.lines);
    if (content.operation === 'save')
        await readAtRevision(content.module, content.billId!, content.expectedRevision, () => deps.repos.bills.get(who, content.module, content.billId!));
}
export async function prepareHumanAction(deps: RuntimeDeps, who: Identity, operationRef: string, content: HumanActionContent): Promise<HumanAction> {
    if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,127}$/.test(operationRef))
        throw new SchemaError('Provide a stable operation id');
    await authorizeHumanAction(deps, who, content);
    const at = deps.now();
    return repo(deps).create(who, { id: randomUUID(), operationRef, revision: 1, contentHash: actionContentHash(content), content, reviewToken: randomBytes(32).toString('hex'), status: HUMAN_ACTION_STATUS.pending, receipt: null, createdAt: at, updatedAt: at, expiresAt: new Date(at.getTime() + 30 * 60000) });
}
export async function getHumanAction(deps: RuntimeDeps, who: Identity, id: string, checkFresh = true): Promise<HumanAction> {
    const row = await repo(deps).get(who, id);
    if (!row)
        throw new HumanActionError('ACTION_NOT_FOUND', 404, 'This pending confirmation does not exist or does not belong to the current user');
    if (row.status === HUMAN_ACTION_STATUS.committed) {
        deps.authorizer.assertModule(who, row.content.module, 'read');
        if (row.receipt)
            await deps.repos.bills.get(who, row.content.module, row.receipt.billId);
    }
    else if (checkFresh)
        await authorizeHumanAction(deps, who, row.content);
    return row;
}
function assertPending(row: HumanAction, revision: number, at: Date) {
    if (row.revision !== revision)
        throw new HumanActionError('ACTION_CHANGED', 409, 'The content was updated; review it again before confirming');
    if (row.status !== HUMAN_ACTION_STATUS.pending)
        throw new HumanActionError('ACTION_CLOSED', 409, 'This action is already closed and can no longer be changed or confirmed');
    if (at.getTime() >= row.expiresAt.getTime())
        throw new HumanActionError('ACTION_EXPIRED', 409, 'This confirmation has expired; prepare it again and review it');
}
export async function reviseHumanAction(deps: RuntimeDeps, who: Identity, id: string, revision: number, content: HumanActionContent) {
    await authorizeHumanAction(deps, who, content);
    return deps.repos.transaction(async (repos) => {
        const tx = { ...deps, repos }, current = await repo(tx).get(who, id, true);
        if (!current)
            throw new HumanActionError('ACTION_NOT_FOUND', 404, 'Pending confirmation does not exist');
        assertPending(current, revision, deps.now());
        if (current.content.module !== content.module || current.content.operation !== content.operation || current.content.billId !== content.billId || current.content.transition?.code !== content.transition?.code)
            throw new SchemaError('A revision cannot change the business module, the operation, or the original bill');
        const nextContent = { ...content, correlation: current.content.correlation };
        return repo(tx).replace(who, current, { ...current, revision: current.revision + 1, content: nextContent, contentHash: actionContentHash(nextContent), reviewToken: randomBytes(32).toString('hex'), updatedAt: deps.now() });
    });
}
export async function cancelHumanAction(deps: RuntimeDeps, who: Identity, id: string, revision: number) {
    return deps.repos.transaction(async (repos) => {
        const tx = { ...deps, repos }, row = await getHumanAction(tx, who, id, false);
        assertPending(row, revision, deps.now());
        return repo(tx).replace(who, row, { ...row, revision: row.revision + 1, status: HUMAN_ACTION_STATUS.cancelled, updatedAt: deps.now() });
    });
}
export async function confirmHumanAction(deps: RuntimeDeps, who: Identity, id: string, revision: number, contentHash: string, reviewToken: string) {
    if (who.agentId !== null)
        throw new HumanActionError('HUMAN_CONFIRM_REQUIRED', 403, 'A user must open the form, review it, and confirm');
    const effects: Parameters<NonNullable<RuntimeDeps['afterBillWrite']>>[0][] = [];
    const result = await deps.repos.transaction(async (repos) => {
        const { afterBillWrite: _hook, ...base } = deps;
        // A Planner may write the source bill and downstream bills together; collect all of them on the existing hook and notify after commit.
        const tx: RuntimeDeps = { ...base, repos, afterBillWrite: async input => { effects.push({ ...input, repos: deps.repos }); } }, row = await repo(tx).get(who, id, true);
        if (!row)
            throw new HumanActionError('ACTION_NOT_FOUND', 404, 'Pending confirmation does not exist');
        const left = Buffer.from(row.reviewToken), right = Buffer.from(reviewToken);
        if (row.revision !== revision || row.contentHash !== contentHash || left.length !== right.length || !timingSafeEqual(left, right))
            throw new HumanActionError('ACTION_REVIEW_CHANGED', 409, 'This confirmation does not match the current content; review it again');
        if (row.status === HUMAN_ACTION_STATUS.committed) {
            await getHumanAction(tx, who, id);
            return row;
        }
        assertPending(row, revision, deps.now());
        await authorizeHumanAction(tx, who, row.content);
        const c = row.content;
        if (c.operation === 'transition' && c.expectedRevision === null) throw new SchemaError('Open the bill and check the current revision and business action first');
        const transitionArgs = c.transition ? { identity: who, module: c.module, billId: c.billId!, transition: c.transition.code, params: c.transition.params, expectedRevision: c.expectedRevision, confirmedWarning: c.transition.confirmedWarning, idempotencyKey: 'human-action-' + row.id } : null;
        const bill = c.operation === 'transition' && transitionArgs
            ? (tx.catalog.modules.get(c.module)!.planners.has(transitionArgs.transition)
                ? (await executePlannedTransition(tx, { ...transitionArgs, expectedFingerprint: c.transition!.fingerprint })).transition.bill
                : (await executeTransition(tx, transitionArgs)).bill)
            : c.operation === 'create'
            ? await createBill(tx, who, c.module, c.header, c.lines!)
            : await saveDraft(tx, who, c.module, c.billId!, c.header, c.lines, c.expectedRevision);
        const receipt = { receiptRef: row.id, actionRef: row.id, actionRevision: row.revision, contentHash: row.contentHash, module: c.module, operation: c.operation, billId: bill.id, billRevision: bill.revision, ...(typeof bill.header['status'] === 'string' ? { billStatus: bill.header['status'] } : {}), committedAt: deps.now().toISOString() };
        return repo(tx).replace(who, row, { ...row, status: HUMAN_ACTION_STATUS.committed, receipt, updatedAt: deps.now() });
    });
    if (deps.afterBillWrite !== undefined)
        for (const effect of effects) await deps.afterBillWrite(effect);
    return result;
}
