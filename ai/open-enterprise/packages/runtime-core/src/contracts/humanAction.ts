export const HUMAN_ACTION_STATUS = { pending: 'pending', committed: 'committed', cancelled: 'cancelled' } as const;
import type { Identity } from './identity.js';
export interface HumanActionCorrelation {
    readonly taskRef: string;
    readonly botRef: string;
    readonly bindingRevision: number;
}
export interface HumanActionContent {
    readonly correlation: HumanActionCorrelation | null;
    readonly operation: 'create' | 'save' | 'transition';
    readonly module: string;
    readonly billId: string | null;
    /** The read revision a person saw; do not re-read and replace it at confirm time. */
    readonly expectedRevision: number | null;
    readonly header: Readonly<Record<string, unknown>>;
    readonly lines: Readonly<Record<string, readonly Readonly<Record<string, unknown>>[]>> | null;
    /** Edge review payload; the revision and preview fingerprint come from the human read, not from model confirmation. */
    readonly transition?: {
        readonly code: string;
        readonly params: Readonly<Record<string, unknown>>;
        readonly confirmedWarning: string | null;
        readonly fingerprint: string | null;
    };
}
export interface HumanActionReceipt {
    readonly receiptRef: string;
    readonly actionRef: string;
    readonly actionRevision: number;
    readonly contentHash: string;
    readonly module: string;
    readonly operation: 'create' | 'save' | 'transition';
    readonly billId: string;
    readonly billRevision: number;
    readonly billStatus?: string;
    readonly committedAt: string;
}
export interface HumanAction {
    readonly id: string;
    readonly operationRef: string;
    readonly revision: number;
    readonly contentHash: string;
    readonly content: HumanActionContent;
    /** Returned only by the human review API; the agent surface must never receive this credential. */
    readonly reviewToken: string;
    readonly status: (typeof HUMAN_ACTION_STATUS)[keyof typeof HUMAN_ACTION_STATUS];
    readonly receipt: HumanActionReceipt | null;
    readonly expiresAt: Date;
    readonly createdAt: Date;
    readonly updatedAt: Date;
}
export class HumanActionError extends Error {
    constructor(readonly code: string, readonly status: 400 | 403 | 404 | 409 | 503, message: string) { super(message); }
}
export interface HumanActionRepo {
    create(identity: Identity, row: HumanAction): Promise<HumanAction>;
    get(identity: Identity, id: string, lock?: boolean): Promise<HumanAction | null>;
    replace(identity: Identity, before: HumanAction, after: HumanAction): Promise<HumanAction>;
}
