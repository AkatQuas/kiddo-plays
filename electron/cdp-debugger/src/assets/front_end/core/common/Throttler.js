export class Throttler {
  #timeout;
  #isRunningProcess;
  #asSoonAsPossible;
  #process;
  #lastCompleteTime;
  #schedulePromise;
  #scheduleResolve;
  #processTimeout;
  constructor(timeout) {
    this.#timeout = timeout;
    this.#isRunningProcess = false;
    this.#asSoonAsPossible = false;
    this.#process = null;
    this.#lastCompleteTime = 0;
    this.#schedulePromise = new Promise((fulfill) => {
      this.#scheduleResolve = fulfill;
    });
  }
  processCompleted() {
    this.#lastCompleteTime = this.getTime();
    this.#isRunningProcess = false;
    if (this.#process) {
      this.innerSchedule(false);
    }
    this.processCompletedForTests();
  }
  processCompletedForTests() {
  }
  get process() {
    return this.#process;
  }
  onTimeout() {
    this.#processTimeout = void 0;
    this.#asSoonAsPossible = false;
    this.#isRunningProcess = true;
    void Promise.resolve().then(this.#process).catch(console.error.bind(console)).then(this.processCompleted.bind(this)).then(this.#scheduleResolve);
    this.#schedulePromise = new Promise((fulfill) => {
      this.#scheduleResolve = fulfill;
    });
    this.#process = null;
  }
  schedule(process, asSoonAsPossible) {
    this.#process = process;
    const hasScheduledTasks = Boolean(this.#processTimeout) || this.#isRunningProcess;
    const okToFire = this.getTime() - this.#lastCompleteTime > this.#timeout;
    asSoonAsPossible = Boolean(asSoonAsPossible) || !hasScheduledTasks && okToFire;
    const forceTimerUpdate = asSoonAsPossible && !this.#asSoonAsPossible;
    this.#asSoonAsPossible = this.#asSoonAsPossible || asSoonAsPossible;
    this.innerSchedule(forceTimerUpdate);
    return this.#schedulePromise;
  }
  innerSchedule(forceTimerUpdate) {
    if (this.#isRunningProcess) {
      return;
    }
    if (this.#processTimeout && !forceTimerUpdate) {
      return;
    }
    if (this.#processTimeout) {
      this.clearTimeout(this.#processTimeout);
    }
    const timeout = this.#asSoonAsPossible ? 0 : this.#timeout;
    this.#processTimeout = this.setTimeout(this.onTimeout.bind(this), timeout);
  }
  clearTimeout(timeoutId) {
    clearTimeout(timeoutId);
  }
  setTimeout(operation, timeout) {
    return window.setTimeout(operation, timeout);
  }
  getTime() {
    return window.performance.now();
  }
}
//# sourceMappingURL=Throttler.js.map
