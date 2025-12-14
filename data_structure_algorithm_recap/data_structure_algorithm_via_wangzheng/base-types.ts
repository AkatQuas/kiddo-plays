export class ListNode {
  next: ListNode | null;
  static create(val: ListNode['value'], next: ListNode['next'] = null) {
    return new ListNode(val, next);
  }
  constructor(public value: number, next: ListNode['next']) {
    this.next = next;
  }
}

export class Stack<T> {
  clear() {
    this.stack = [];
  }
  stack: T[];
  constructor() {
    this.stack = [];
  }
  copy(): Stack<T> {
    const stack = ([] as T[]).concat(this.stack);
    const x = new Stack<T>();
    let p: T | undefined;
    while ((p = stack.pop()) !== undefined) {
      x.push(p);
    }
    return x;
  }
  push(v: T) {
    this.stack.push(v);
  }
  pop(): T | null {
    const x = this.stack.pop();
    return x ?? null;
  }
  peek(): T | null {
    const p = this.stack[this.stack.length - 1];
    return p ?? null;
  }
  isEmpty(): boolean {
    return this.stack.length === 0;
  }
}
