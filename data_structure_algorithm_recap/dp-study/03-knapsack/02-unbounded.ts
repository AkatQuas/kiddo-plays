/**
 * 🎒 3-2 完全背包（Unbounded Knapsack）
 *
 * 问题：N 种物品，每种重 w[i]、价值 v[i]。背包容量 C，每种无限个。
 * 求最大总价值。
 *
 * 思路：
 *   dp[i][c] = max(dp[i-1][c], dp[i][c-w[i]] + v[i])
 *   选了 i 后还可以继续选 → 用 dp[i][c-w] 而不是 dp[i-1][c-w]
 *
 * 和 0/1 背包的唯一区别：容量遍历方向！
 *   0/1 背包：倒序（不能重复选）
 *   完全背包：正序（可以重复选）
 *
 * ────────────────────────────────────────────────────
 */

// ─── 二维 DP ──────────────────────────────────────
function unboundedKnapsack(weights: number[], values: number[], capacity: number): number {
  const n = weights.length;
  const dp: number[][] = Array.from({ length: n + 1 }, () => Array(capacity + 1).fill(0));
  for (let i = 1; i <= n; i++) {
    const w = weights[i - 1], v = values[i - 1];
    for (let c = 0; c <= capacity; c++) {
      dp[i][c] = dp[i - 1][c];
      if (c >= w) dp[i][c] = Math.max(dp[i][c], dp[i][c - w] + v);
    }
  }
  return dp[n][capacity];
}

// ─── 空间优化（一维，容量正序） ────────────────────
function unboundedKnapsackOpt(weights: number[], values: number[], capacity: number): number {
  const dp: number[] = Array(capacity + 1).fill(0);
  for (let i = 0; i < weights.length; i++) {
    const w = weights[i], v = values[i];
    for (let c = w; c <= capacity; c++) {
      dp[c] = Math.max(dp[c], dp[c - w] + v);
    }
  }
  return dp[capacity];
}

// ─── 测试 ─────────────────────────────────────────
console.log('=== 完全背包 ===\n');
const weights = [2, 3, 4], values = [3, 4, 5];
for (const cap of [5, 6, 10, 15]) {
  console.log(`容量 ${cap}: 最大价值 = ${unboundedKnapsack(weights, values, cap)}`);
}
