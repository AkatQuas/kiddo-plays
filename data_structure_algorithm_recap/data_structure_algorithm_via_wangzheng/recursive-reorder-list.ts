/**
 * https://leetcode.com/problems/reorder-list/
 */
import { ListNode } from './base-types';

function deleteNode(head: ListNode | null, target: ListNode) {
  const dummy = {
    next: head,
  } as ListNode;
  let cursor: ListNode = dummy;
  while (cursor.next !== null && cursor.next !== target) {
    cursor = cursor.next;
  }

  cursor.next = cursor.next!.next;

  return dummy.next;
}

// It's kind of time-consuming to use recursive, O(n2), space is O(1)
// You can use array to de-construct the linked list and using cursor to re-build new one, so time is O(n), space is O(n)
function reorderList(head: ListNode | null): void {
  if (head === null || head.next === null) {
    return undefined;
  }
  let tail = head;
  while (tail.next !== null) {
    tail = tail.next;
  }
  deleteNode(head, tail);
  const l1ton_1 = head.next;

  head.next = tail;
  tail.next = l1ton_1;

  reorderList(l1ton_1);
}
