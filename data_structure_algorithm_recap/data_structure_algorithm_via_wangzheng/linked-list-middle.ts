/**
 * https://leetcode.com/problems/middle-of-the-linked-list/
 */

import { ListNode } from './base-types';

// do some real math
// find the end condition
export function middleNode(head: ListNode | null): ListNode | null {
  let f = head;
  let s = head;

  while (f && f.next) {
    f = f.next.next as ListNode;
    s = s!.next as ListNode;
  }
  return s;
}
