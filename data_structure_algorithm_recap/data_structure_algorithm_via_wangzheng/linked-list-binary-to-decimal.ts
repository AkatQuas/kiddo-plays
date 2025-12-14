/**
 * https://leetcode.com/problems/convert-binary-number-in-a-linked-list-to-integer/
 */

import { ListNode } from './base-types';

function getDecimalValue(head: ListNode): number {
  let sum = 0;
  let p: ListNode | null = head;
  while (p !== null) {
    sum = sum * 2 + p.value;
    p = p.next;
  }
  return sum;
}
