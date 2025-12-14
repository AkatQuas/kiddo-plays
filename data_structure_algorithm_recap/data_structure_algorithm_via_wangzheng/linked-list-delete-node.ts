/**
 * https://leetcode.com/problems/delete-node-in-a-linked-list/
 */

import { ListNode } from './base-types';

/**
 Look at the constraints:

  The value of each node in the list is unique.
  The node to be deleted is in the list and is not a tail node

  So we're not actually removing the node, but faking it to be the next one.

 */
/**
 * @param toDelete
 */
function deleteNode(toDelete: ListNode | null): void {
  if (toDelete === null) {
    return undefined;
  }
  const toMock = toDelete.next!;
  toDelete.value = toMock.value;
  toDelete.next = toMock.next;
}
