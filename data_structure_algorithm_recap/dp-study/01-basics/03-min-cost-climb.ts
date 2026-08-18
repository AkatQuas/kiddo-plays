/**
 * 📘 1-3 最小花费爬楼梯
 *
 * 问题：每阶楼梯有 cost[i]，从 i 阶往上爬需付 cost[i]。
 * 可从第 0 或第 1 阶开始，每次爬 1 或 2 阶。求到楼顶的最小花费。
 *
 * 思路：
 *   dp[i] = 到达 i 阶的最小总花费（含本阶 cost）
 *   dp[i] = min(dp[i-1], dp[i-2]) + cost[i]
 *   最终答案 = min(dp[n-1], dp[n-2])  —— 楼顶在 n 阶之后，不需再出发
 *
 * 从"计数"到"求最值"的转折点。
 *
 * ─── LeetCode 746 ─────────────────────────────────
 */

function minCostClimbingStairs(cost: number[]): number {
  const n = cost.length;
  if (n === 2) return Math.min(cost[0], cost[1]);
  const dp: number[] = [];
  dp[0] = cost[0];
  dp[1] = cost[1];
  for (let i = 2; i < n; i++) {
    dp[i] = Math.min(dp[i - 1], dp[i - 2]) + cost[i];
  }
  return Math.min(dp[n - 1], dp[n - 2]);
}

// ─── 空间优化 ─────────────────────────────────────
function minCostClimbingStairsOpt(cost: number[]): number {
  const n = cost.length;
  if (n === 2) return Math.min(cost[0], cost[1]);
  let prev2 = cost[0], prev1 = cost[1];
  for (let i = 2; i < n; i++) {
    const cur = Math.min(prev1, prev2) + cost[i];
    prev2 = prev1;
    prev1 = cur;
  }
  return Math.min(prev1, prev2);
}

// ─── 测试 ─────────────────────────────────────────
console.log('=== 最小花费爬楼梯 ===\n');
const cases = [
  [10, 15, 20],
  [1, 100, 1, 1, 1, 100, 1, 1, 100, 1],
];
for (const cost of cases) {
  console.log(`cost = [${cost}] → ${minCostClimbingStairs(cost)}`);
}
