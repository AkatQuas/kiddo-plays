/**
 * ============================================================
 * 📘 3-1 0/1 背包问题
 * ============================================================
 *
 * 问题：有 N 个物品，每个物品重 w[i]，价值 v[i]。
 * 背包容量为 C，每种物品最多选 1 个，求最大总价值。
 *
 * 为什么学这个？
 * 0/1 背包是 DP 最重要的模型！没有之一。
 * 它是"选/不选"决策的经典代表。
 * 后面很多问题（子集、分割等和子集、目标总和）都是它的变体。
 *
 * 思路：
 *  状态定义：dp[i][c] = 前 i 个物品中，容量为 c 时的最大价值
 *  转移方程：
 *    不选第 i 个物品：dp[i][c] = dp[i-1][c]
 *    选第 i 个物品：  dp[i][c] = dp[i-1][c-w[i]] + v[i]  （前提 c >= w[i]）
 *    取二者最大值
 *  边界：dp[0][c] = 0（没有物品可选）
 *
 *  空间优化：用一维数组，容量从大到小遍历（防止重复选）
 */

// ─── 基础版：二维数组 ──────────────────────────────────
function knapsack01(weights: number[], values: number[], capacity: number): number {
  const n = weights.length;
  // dp[i][c] = 前 i 个物品，容量 c 的最大价值
  const dp: number[][] = Array.from({ length: n + 1 }, () => Array(capacity + 1).fill(0));

  for (let i = 1; i <= n; i++) {
    const w = weights[i - 1];
    const v = values[i - 1];
    for (let c = 0; c <= capacity; c++) {
      // 不选第 i 个物品
      dp[i][c] = dp[i - 1][c];
      // 如果放得下，尝试选第 i 个物品
      if (c >= w) {
        dp[i][c] = Math.max(dp[i][c], dp[i - 1][c - w] + v);
      }
    }
  }

  return dp[n][capacity];
}

// ─── 空间优化版：一维数组，容量倒序遍历 ────────────────
// 关键：为什么容量要倒序？
//   dp[c] 在更新时，dp[c-w] 必须是"上一行"的值
//   如果从左到右，dp[c-w] 已经被当前行更新了，相当于"选了多次"
//   从右到左，保证 dp[c-w] 还是上一行的值
function knapsack01Opt(weights: number[], values: number[], capacity: number): number {
  const n = weights.length;
  const dp: number[] = Array(capacity + 1).fill(0);

  for (let i = 0; i < n; i++) {
    const w = weights[i];
    const v = values[i];
    // 容量从大到小遍历
    for (let c = capacity; c >= w; c--) {
      dp[c] = Math.max(dp[c], dp[c - w] + v);
    }
  }

  return dp[capacity];
}

// ─── 测试 ──────────────────────────────────────────────
console.log('=== 0/1 背包问题 ===\n');

// 物品：重量 [2, 3, 4, 5]，价值 [3, 4, 5, 6]
// 容量 5：最优选 物品2(3重4价) + 物品1(2重3价) = 总价 7
const weights = [2, 3, 4, 5];
const values = [3, 4, 5, 6];
const capacities = [5, 8, 10];

for (const cap of capacities) {
  const r1 = knapsack01(weights, values, cap);
  const r2 = knapsack01Opt(weights, values, cap);
  console.log(`容量 ${cap}: 最大价值 = ${r1}（空间优化: ${r2}）`);
}

console.log('\n💡 关键认识：');
console.log('  0/1 背包 = 每个物品选/不选，容量维度倒序遍历');
console.log('  这是"选/不选"决策模型的原型');
console.log('  LeetCode 416(分割等和子集)、494(目标和) 都是它的变体');
console.log('\n  🔑 容量倒序的原因：');
console.log('    一维数组 dp[c] 存储的是"上一行"的值');
console.log('    如果正序遍历，dp[c-w] 会被当前行覆盖');
console.log('    相当于物品被选了多次（变成完全背包了）');