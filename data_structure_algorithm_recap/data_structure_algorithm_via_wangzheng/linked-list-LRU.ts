/**
 * Least Recently Used, built upon linked list
 */

import { ListNode } from './base-types';

class LinkList {
  private head: ListNode['next'];
  private count: number;
  constructor(readonly size: number) {
    this.head = null;
    this.count = 0;
  }
  getHead() {
    return this.head;
  }
  add(value: number): void {
    // find the target node if exist
    let toMutate = findByValue(this.head, value);
    if (toMutate !== null) {
      // toMutate is head, do nothing
      if (toMutate === this.head) {
        return;
      }

      const prev = findPrev(this.head, toMutate);

      if (prev === null) {
        throw new Error(
          'What wrong with you ??[failed to find prev for mutate node]'
        );
      }

      // move exist to the head
      prev.next = toMutate.next;
      toMutate.next = this.head;
      this.head = toMutate;
      return;
    }

    // capacity available
    if (this.count < this.size) {
      this.head = ListNode.create(value, this.head);
      this.count += 1;
      return;
    }

    // no more capacity available
    const tail = findTail(this.head);
    const prev = findPrev(this.head, tail);
    if (prev === null) {
      throw new Error('What wrong with you ?? [failed to find prev for tail]');
    }
    prev.next = null;
    this.head = ListNode.create(value, this.head);
    return;
  }
}

function doCheck(size: number, input: number[], output: number) {
  const list = new LinkList(size);
  input.forEach((v) => list.add(v));
  const tail = findTail(list.getHead());
  console.assert(
    tail.value === output,
    `Size: ${size}\n\tInput: ${input.toString()}\n\tOutput:${output}\n\tReal: ${
      tail.value
    }`
  );
}

function main() {
  {
    [
      { input: [3, 2, 1, 4, 4, 2, 3], output: 1 },
      { input: [3, 2, 1, 4, 4, 2, 1], output: 3 },
      { input: [4, 2, 1, 4, 3, 2, 3], output: 1 },
      { input: [1, 2, 3, 4], output: 1 },
    ].forEach(({ input, output }) => {
      doCheck(5, input, output);
    });
  }
  {
    [
      { input: [3, 2, 1, 4, 4, 2, 3], output: 1 },
      { input: [3, 2, 1, 4, 4, 2, 1], output: 3 },
      { input: [4, 2, 1, 4, 3, 2, 3], output: 1 },
      { input: [1, 2, 3, 4], output: 1 },
    ].forEach(({ input, output }) => {
      doCheck(4, input, output);
    });
  }
  {
    [
      { input: [3, 2, 1, 4, 4, 2, 3], output: 4 },
      { input: [3, 2, 1, 4, 4, 2, 1], output: 4 },
      { input: [4, 2, 1, 4, 3, 2, 3], output: 4 },
      { input: [1, 2, 3, 4], output: 2 },
    ].forEach(({ input, output }) => {
      doCheck(3, input, output);
    });
  }
}

main();

/* --- --- */

/**
 * given a head of linked list, return its tail
 * @param node
 * @returns
 */
function findTail(node: ListNode['next']): ListNode {
  if (node === null) {
    throw new Error("What's wrong with you ??");
  }
  if (node.next === null) {
    return node;
  }

  return findTail(node.next);
}

/**
 * Find a node matches the value
 * @param head
 * @param value target value
 * @returns maybe a found node
 */
function findByValue(head: ListNode['next'], value: number): ListNode['next'] {
  let cursor = head;
  while (true) {
    if (cursor === null) {
      return null;
    }

    if (cursor.value === value) {
      return cursor;
    }
    cursor = cursor.next;
  }
}

/**
 * Find a node's prev in a linked list
 * @param head
 * @param n target node
 * @returns maybe found prev node
 */
function findPrev(head: ListNode['next'], n: ListNode): ListNode['next'] {
  let cursor = head;
  while (true) {
    if (cursor === null) {
      return null;
    }

    if (cursor.next === n) {
      return cursor;
    }
    cursor = cursor.next;
  }
}

function printList(head: ListNode['next']) {
  let cursor = head;
  if (cursor == null) {
    return;
  }
  console.log(cursor.value);
  printList(cursor.next);
}
