/**
 * https://leetcode.com/problems/number-of-recent-calls/
 */

// Use queue to save for threshold values
class RecentCounter {
  queue: number[];
  constructor() {
    this.queue = [];
  }

  ping(t: number): number {
    this.queue.push(t);
    const threshold = t - 3000;
    while (this.queue.length > 0) {
      if (this.queue[0] < threshold) {
        this.queue.shift();
      } else {
        break;
      }
    }
    return this.queue.length;
  }
}
