// Features:
// * Turn exceptions in user code into rejections
//
// Changes:
// * .resolve() and .reject() work differently now
// * New helper function: isThenable()

import * as assert from 'assert';
import {
  addToTaskQueue,
  FulfillCallback,
  isThenable,
  PromiseLike,
  PromiseState,
  RejectionCallback,
  TaskCallback,
} from './utils';

export class ToyPromise4 implements PromiseLike {
  _state: PromiseState = PromiseState.pending;
  _result: any;
  _fulfillmentTasks: any[] = [];
  _rejectionTasks: any[] = [];
  _alreadyResolved = false;

  then(
    onFulfilled?: FulfillCallback,
    onRejected?: RejectionCallback
  ): void | PromiseLike {
    const resultPromise = new ToyPromise4();

    const fulfillmentTask = () => {
      if (typeof onFulfilled === 'function') {
        this._runReactionSafely(resultPromise, onFulfilled);
      } else {
        // `onFulfilled` is missing
        // past on the fulfillment value
        resultPromise.resolve(this._result);
      }
    };
    const rejectionTask = () => {
      if (typeof onRejected === 'function') {
        this._runReactionSafely(resultPromise, onRejected);
      } else {
        // `onRejected` is missing
        // => pass on the rejection value
        resultPromise.reject(this._result);
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
        throw new Error();
    }

    return resultPromise;
  }

  _runReactionSafely(resultPromise: PromiseLike, reaction: TaskCallback) {
    try {
      const returned = reaction(this._result);
      resultPromise.resolve(returned);
    } catch (e) {
      resultPromise.reject(e);
    }
  }
  resolve(value: unknown): void | PromiseLike {
    if (this._alreadyResolved) {
      return this;
    }
    this._alreadyResolved = true;
    if (isThenable(value)) {
      // Forward fulfillments and rejections from `value` to `this`.
      // The callbacks are always executed asynchronously
      (value as PromiseLike).then(
        (result) => this._doFulfill(result),
        (error) => this._doReject(error)
      );
    } else {
      this._doFulfill(value);
    }

    return this; // enable chaining
  }
  _doFulfill(value: unknown): void {
    assert.ok(!isThenable(value));
    this._state = PromiseState.fulfilled;
    this._result = value;
    this._clearAndEnqueueTasks(this._fulfillmentTasks);
  }
  reject(error?: any): void | PromiseLike {
    if (this._alreadyResolved) {
      return this;
    }
    this._alreadyResolved = true;
    this._doReject(error);
    return this;
  }
  _doReject(error?: any): void {
    this._state = PromiseState.rejected;
    this._result = error;
    this._clearAndEnqueueTasks(this._rejectionTasks);
  }

  catch?(onRejected?: RejectionCallback): void | PromiseLike {
    return this.then(undefined, onRejected);
  }
  _clearAndEnqueueTasks(tasks: TaskCallback[]) {
    this._fulfillmentTasks = [];
    this._rejectionTasks = [];
    tasks.map(addToTaskQueue);
  }
}
