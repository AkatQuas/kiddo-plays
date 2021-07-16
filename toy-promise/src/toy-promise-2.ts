// New features:
// * `.then()` returns a promise, which fulfills with what
//   either `onFulfilled` or `onRejected` return
// * Missing `onFulfilled` and `onRejected` pass on what they receive
// * New convenience method `.catch()`
//
// Changes:
// * Several locations inside `.then()`

import {
  addToTaskQueue,
  FulfillCallback,
  PromiseLike,
  PromiseState,
  RejectionCallback,
  TaskCallback,
} from './utils';

export class ToyPromise2 implements PromiseLike {
  _state: PromiseState = PromiseState.pending;
  _result: any;
  _fulfillmentTasks: any[] = [];
  _rejectionTasks: any[] = [];
  then(
    onFulfilled?: FulfillCallback,
    onRejected?: RejectionCallback
  ): void | PromiseLike {
    const resultPromise = new ToyPromise2();

    const fulfillmentTask = () => {
      if (typeof onFulfilled === 'function') {
        const returned = onFulfilled(this._result);
        resultPromise.resolve(returned);
      } else {
        // `onFulfilled` is missing
        // past on the fulfillment value
        resultPromise.resolve(this._result);
      }
    };
    const rejectionTask = () => {
      if (typeof onRejected === 'function') {
        const returned = onRejected(this._result);
        resultPromise.resolve(returned);
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
  resolve(value: unknown): void | PromiseLike {
    if (this._state !== PromiseState.pending) {
      return this;
    }
    this._state = PromiseState.fulfilled;
    this._result = value;
    this._clearAndEnqueueTasks(this._fulfillmentTasks);
    return this; // enable chaining
  }
  reject(error?: any): void | PromiseLike {
    if (this._state !== PromiseState.pending) {
      return this;
    }
    this._state = PromiseState.rejected;
    this._result = error;
    this._clearAndEnqueueTasks(this._rejectionTasks);
    return this;
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
