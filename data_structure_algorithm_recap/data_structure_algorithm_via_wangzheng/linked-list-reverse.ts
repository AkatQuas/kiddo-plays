/**
 * https://leetcode.com/problems/reverse-linked-list/
 */

import { ListNode } from './base-types';

/**
 * @param {ListNode} head
 * @return {ListNode}
 */
export const reverseList = (head: ListNode['next']): ListNode['next'] => {
  // create a new dummy node
  // iterate over list, add the item-node before the dummy, move dummy to latest head
  // when no more node, simple return the head
  let dummy: ListNode['next'] = null;
  let cursor: ListNode['next'] = head;
  while (cursor !== null) {
    const next: ListNode['next'] = cursor.next;
    cursor.next = dummy;
    dummy = cursor;
    cursor = next;
  }
  return dummy;
};
