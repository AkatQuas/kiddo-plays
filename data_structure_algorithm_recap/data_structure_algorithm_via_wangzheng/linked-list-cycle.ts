/**
 * https://leetcode.com/problems/linked-list-cycle/
 */

import { ListNode } from './base-types';

/**
 * Two cursor
 * @param head
 * @returns
 */
export function hasCycle(head: ListNode | null): boolean {
  if (head === null) {
    return false;
  }
  let slow: ListNode | null = head;
  let fast = head.next;
  while (fast !== null && fast.next !== null) {
    if (slow === fast) {
      return true;
    }

    slow = slow!.next;
    fast = fast.next.next;
  }

  return false;
}

/**
 * Flag the iterated node with value
 * @param head
 * @returns
 */
export function hasCycle2(head: ListNode | null) {
  let cursor = head;
  while (cursor !== null) {
    if (cursor.value === +Infinity) {
      return true;
    }
    cursor.value = +Infinity;
    cursor = cursor.next;
  }
  return false;
}
