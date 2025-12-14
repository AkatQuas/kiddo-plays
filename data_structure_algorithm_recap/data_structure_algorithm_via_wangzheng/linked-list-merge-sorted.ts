/**
 * https://leetcode.com/problems/merge-two-sorted-lists/
 */

import { ListNode } from './base-types';

export function mergeTwoLists(
  list1: ListNode | null,
  list2: ListNode | null
): ListNode | null {
  const dummy = {
    value: -Infinity,
    next: null,
  } as ListNode;

  let p = dummy;
  let c1 = list1;
  let c2 = list2;

  while (true) {
    if (c1 === null) {
      p.next = c2;
      break;
    } else if (c2 === null) {
      p.next = c1;
      break;
    }
    if (c1.value < c2.value) {
      p.next = c1;
      c1 = c1.next;
    } else {
      p.next = c2;
      c2 = c2.next;
    }
    p = p.next;
  }

  return dummy.next;
}
