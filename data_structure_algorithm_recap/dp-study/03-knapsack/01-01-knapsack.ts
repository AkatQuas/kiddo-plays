/**
 * 🎒 3-1 0/1 背包问题
 *
 * 问题：N 个物品，每个重 w[i]、价值 v[i]。背包容量 C，每种最多选 1 个。
 * 求最大总价值。
 *
 * 思路：
 *   dp[i][c] = 前 i 个物品，容量 c 时的最大价值
 *   不选 i: dp[i-1][c]
 *   选 i:   dp[i-1][c-w[i]] + v[i]（前提 c >= w[i]）
 *   取二者 max
 *
 * 学习点：这是 DP 最重要的模型。选/不选决策 + 容量维度。
 * 空间优化关键：容量倒序遍历（防止重复选）
 *
 * ────────────────────────────────────────────────────
 */

// ─── 二维 DP ──────────────────────────────────────
function knapsack01(weights: number[], values: number[], capacity: number): number {
  const n = weights.length;
  const dp: number[][] = Array.from({ length: n + 1 }, () => Array(capacity + 1).fill(0));
  for (let i = 1; i <= n; i++) {
    const w = weights[i - 1], v = values[i - 1];
    for (let c = 0; c <= capacity; c++) {
      dp[i][c] = dp[i - 1][c];
      if (c >= w) dp[i][c] = Math.max(dp[i][c], dp[i - 1][c - w] + v);
    }
  }
  return dp[n][capacity];
}

// ─── 空间优化（一维，容量倒序） ────────────────────
function knapsack01Opt(weights: number[], values: number[], capacity: number): number {
  const dp: number[] = Array(capacity + 1).fill(0);
  for (let i = 0; i < weights.length; i++) {
    const w = weights[i], v = values[i];
    for (let c = capacity; c >= w; c--) {
      dp[c] = Math.max(dp[c], dp[c - w] + v);
    }
  }
  return dp[capacity];
}

// ─── 测试 ─────────────────────────────────────────
console.log('=== 0/1 背包 ===\n');
const weights = [2, 3, 4, 5], values = [3, 4, 5, 6];
for (const cap of [5, 8, 10]) {
  console.log(`容量 ${cap}: 最大价值 = ${knapsack01(weights, values, cap)}`);
}
