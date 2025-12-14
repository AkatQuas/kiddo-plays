/**
 * Using stacks to create a history of action, so it's convenient to undo / redo.
 *
 */

import { Stack } from './base-types';

type Job = [1 | -1, number];

class Bank {
  actions: Stack<Job>;
  reverseAction: Stack<Job>;
  constructor(private base: number) {
    this.actions = new Stack<Job>();
    this.reverseAction = new Stack<Job>();
  }
  add(v: number): void {
    if (!this.reverseAction.isEmpty()) {
      this.reverseAction.clear();
    }
    this.actions.push([1, v]);
  }
  withdraw(v: number): void {
    if (!this.reverseAction.isEmpty()) {
      this.reverseAction.clear();
    }
    this.actions.push([-1, v]);
  }
  undo(): void {
    const x = this.actions.peek();
    if (!x) {
      console.warn('You can undo for empty actions');
      return;
    }
    this.reverseAction.push(this.actions.pop()!);
  }
  redo(): void {
    const x = this.reverseAction.peek();
    if (!x) {
      console.warn('You can undo for empty actions');
      return;
    }
    this.actions.push(this.reverseAction.pop()!);
  }
  balance(): number {
    let base = this.base;
    const actions = this.actions.copy();
    let job: Job | null;
    while ((job = actions.pop()) !== null) {
      base += job[0] * job[1];
    }
    return base;
  }
}

function assertValue(bank: Bank, expect: number) {
  const actual = bank.balance();
  console.assert(actual === expect, `Should be ${expect}, but got ${actual}`);
}

function test() {
  const bank = new Bank(100);
  bank.add(10);
  bank.add(20);
  bank.undo();
  assertValue(bank, 110);
  bank.undo();
  assertValue(bank, 100);
  bank.redo();
  bank.redo();
  assertValue(bank, 130);

  const bank2 = new Bank(100);
  bank.withdraw(20);
  bank.add(30);
  assertValue(bank, 110);
  bank.undo();
  bank.add(40);
  bank.redo();
}

test();
