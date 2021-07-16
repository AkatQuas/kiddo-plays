export type FulfillCallback = (value: unknown) => void;
export type RejectionCallback = (reason?: any) => void;
export type TaskCallback = FulfillCallback | RejectionCallback;
export type VoidCallback = () => void;

export interface PromiseLike {
  _state: PromiseState;
  _result: any;
  _fulfillmentTasks: VoidCallback[] | undefined;
  _rejectionTasks: VoidCallback[] | undefined;
  _alreadyResolved?: boolean;

  then(
    onFulfilled?: FulfillCallback,
    onRejected?: RejectionCallback
  ): void | PromiseLike;
  catch?(onRejected?: RejectionCallback): void | PromiseLike;
  resolve(value: unknown): void | PromiseLike;
  reject(error?: any): void | PromiseLike;
}

export function addToTaskQueue(task: TaskCallback) {
  setTimeout(task, 0);
}

export function isThenable(value: any) {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof value.then === 'function'
  );
}

export enum PromiseState {
  pending = 'pending',
  fulfilled = 'fulfilled',
  rejected = 'rejected',
}
