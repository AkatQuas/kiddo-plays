/**
 * https://leetcode.com/problems/remove-nth-node-from-end-of-list/
 */

import { ListNode } from './base-types';

export function removeNthFromEnd(
  head: ListNode | null,
  n: number
): ListNode | null {
  const dummy = {
    val: 0,
    next: head,
  };

  let p = dummy;
  let h = dummy;
  while (n > 0) {
    p = p.next as ListNode;
    n = n - 1;
  }
  while (p.next !== null) {
    p = p.next;
    h = h.next as ListNode;
  }
  h.next = h.next!.next;
  return dummy.next;
}
