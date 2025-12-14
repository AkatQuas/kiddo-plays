/**
 * https://leetcode.com/problems/next-greater-element-i/
 */

import { Stack } from './base-types';

/**
 * Brute force
 * @param numA
 * @param numB
 */
function nextGreaterElement(numA: number[], numB: number[]): number[] {
  const getNextGreater = (num: number, numX: number[]) => {
    const idx = numX.indexOf(num);
    for (let i = idx + 1; i < numX.length; i++) {
      const el = numX[i];
      if (el > num) {
        return el;
      }
    }
    return -1;
  };
  return numA.map((num) => getNextGreater(num, numB));
}

/**
 * Look at the constraints:
 *
 *   3: All integers in numA and numB are unique.
 *   4: All the integers of numA also appear in numB.
 */

function nextGreaterElementWithStack(numA: number[], numB: number[]): number[] {
  const stack = new Stack<number>();
  const map = new Map<number, number>();
  for (let index = 0; index < numB.length; index++) {
    const element = numB[index];
    // stack is not empty
    // it has some numbers pushed in advance to current element,
    // current is kind of right next element to them,
    // so we need to make some comparison
    while (!stack.isEmpty() && stack.peek()! < element) {
      // yes, smaller than current,
      // so current is the nextGreaterElement
      map.set(stack.pop()!, element);
    }
    // 1. top is bigger than current,
    //     current cannot be the nextGreaterElement to top and numbers before top
    // 2. stack is empty,
    //
    // just push element into stack for next comparison happens
    stack.push(element);
  }
  return numA.map((num) => map.get(num) ?? -1);
}
