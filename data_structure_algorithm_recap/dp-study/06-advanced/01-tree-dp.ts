/**
 * 🚀 6-1 树形 DP（Tree DP）
 *
 * 问题：打家劫舍 III —— 树上偷东西，不能偷相邻节点，求最大金额。
 *
 * 思路：
 *   后序遍历，每个节点返回两个状态 [偷, 不偷]
 *   偷 node：node.val + 不偷左子 + 不偷右子
 *   不偷 node：max(偷左子, 不偷左子) + max(偷右子, 不偷右子)
 *
 * 学习点：树形 DP = 后序遍历 + 每个节点做决策。
 * 树的结构天然适合 DP：子结果递归计算，父结果组合子结果。
 *
 * ─── LeetCode 337 ─────────────────────────────────
 */

interface TreeNode {
  val: number;
  left: TreeNode | null;
  right: TreeNode | null;
}

function rob(root: TreeNode | null): number {
  function dfs(node: TreeNode | null): [number, number] {
    if (!node) return [0, 0];
    const [lRob, lNot] = dfs(node.left);
    const [rRob, rNot] = dfs(node.right);
    const robCur = node.val + lNot + rNot;
    const notRob = Math.max(lRob, lNot) + Math.max(rRob, rNot);
    return [robCur, notRob];
  }
  return Math.max(...dfs(root));
}

// ─── 测试 ─────────────────────────────────────────
function buildTree(values: (number | null)[]): TreeNode | null {
  if (!values.length || values[0] === null) return null;
  const root: TreeNode = { val: values[0]!, left: null, right: null };
  const queue: (TreeNode | null)[] = [root];
  let i = 1;
  while (queue.length > 0 && i < values.length) {
    const node = queue.shift()!;
    if (node) {
      if (i < values.length && values[i] !== null) {
        node.left = { val: values[i]!, left: null, right: null };
        queue.push(node.left);
      }
      i++;
      if (i < values.length && values[i] !== null) {
        node.right = { val: values[i]!, left: null, right: null };
        queue.push(node.right);
      }
      i++;
    }
  }
  return root;
}

console.log('=== 树形 DP ===\n');
console.log('[3,2,3,null,3,null,1] →', rob(buildTree([3,2,3,null,3,null,1])), '(期望 7)');
console.log('[3,4,5,1,3,null,1] →', rob(buildTree([3,4,5,1,3,null,1])), '(期望 9)');
