// Features:
// * `.then()` must work independently if the promise is
//   settled either before or after it is called
// * You can only `resolve` or `reject` once

import {
  addToTaskQueue,
  FulfillCallback,
  PromiseLike,
  PromiseState,
  RejectionCallback,
  TaskCallback,
} from './utils';

export class ToyPromise1 implements PromiseLike {
  _result: any = undefined;
  _fulfillmentTasks: any[] = [];
  _rejectionTasks: any[] = [];
  _state = PromiseState.pending;

  then(onFulfilled?: FulfillCallback, onRejected?: RejectionCallback) {
    const fulfillmentTask = () => {
      if (typeof onFulfilled === 'function') {
        onFulfilled(this._result);
      }
    };
    const rejectionTask = () => {
      if (typeof onRejected === 'function') {
        onRejected(this._result);
      }
    };
    switch (this._state) {
      case PromiseState.pending:
        this._fulfillmentTasks.push(fulfillmentTask);
        this._rejectionTasks.push(rejectionTask);
        break;
      case PromiseState.fulfilled:
        addToTaskQueue(fulfillmentTask);
        break;
      case PromiseState.rejected:
        addToTaskQueue(rejectionTask);
        break;
      default:
        throw new Error('');
    }
  }

  /**
   * resolve the promise, if it is in pending
   * @param value
   * @returns
   */
  resolve(value: unknown) {
    if (this._state !== PromiseState.pending) {
      return this;
    }
    this._state = PromiseState.fulfilled;
    this._result = value;
    this._clearAndEnqueueTasks(this._fulfillmentTasks);
    return this; // enable chaining
  }

  reject(error?: any) {
    if (this._state !== PromiseState.pending) {
      return this;
    }
    this._state = PromiseState.rejected;
    this._result = error;
    this._clearAndEnqueueTasks(this._rejectionTasks);
    return this;
  }

  _clearAndEnqueueTasks(tasks: TaskCallback[]) {
    this._fulfillmentTasks = [];
    this._rejectionTasks = [];
    tasks.map(addToTaskQueue);
  }
}
