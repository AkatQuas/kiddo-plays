interface IScheduler<T extends VoidFunction> {
  start: VoidFunction;
  add: (fn: T) => void;
  tick: VoidFunction;
  shouldYield: () => boolean;
  flush: VoidFunction;
}

const THRESHOLD = 1000 / 60;

class Scheduler<T extends VoidFunction> implements IScheduler<T> {
  private deadline = performance.now() + THRESHOLD;
  private resolved = Promise.resolve();
  shouldYield() {
    return performance.now() < this.deadline;
  }
  private stack: T[] = [];
  private queued: boolean = false;

  start() {
    this.tick();
  }

  add(fn: T) {
    this.stack.push(fn);
    this.tick();
  }

  tick() {
    if (!this.queued) {
      this.resolved.then(() => this.flush());
      this.queued = true;
    }
  }

  flush() {
    this.deadline = performance.now() + THRESHOLD;
    while (this.shouldYield()) {
      const work = this.stack.shift();
      if (work) {
        work();
      } else {
        break;
      }
    }
    this.queued = false;
    if (this.stack.length > 0) {
      this.tick();
    }
  }
}
