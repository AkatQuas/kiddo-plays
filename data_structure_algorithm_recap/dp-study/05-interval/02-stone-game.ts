/**
 * 🔗 5-2 石子合并（区间 DP 经典问题）
 *
 * 问题：一排石子，每次合并相邻两堆，代价为两堆重量之和。
 * 求全部合并成一堆的最小总代价。
 *
 * 思路：
 *   dp[i][j] = 合并石子 i..j 的最小代价
 *   枚举分割点 k (i ≤ k < j)：
 *     dp[i][j] = min(dp[i][k] + dp[k+1][j] + sum[i][j])
 *   其中 sum[i][j] 用前缀和快速计算
 *
 * 学习点：区间 DP 三要素：
 *   ① 按区间长度从小到大遍历
 *   ② 枚举区间内的分割点
 *   ③ 合并左右子区间的结果
 *
 * ────────────────────────────────────────────────────
 */

function stoneGame(stones: number[]): number {
  const n = stones.length;
  if (n <= 1) return 0;
  const prefix: number[] = Array(n + 1).fill(0);
  for (let i = 0; i < n; i++) prefix[i + 1] = prefix[i] + stones[i];
  const sum = (i: number, j: number) => prefix[j + 1] - prefix[i];
  const dp: number[][] = Array.from({ length: n }, () => Array(n).fill(0));
  for (let len = 2; len <= n; len++) {
    for (let i = 0; i + len - 1 < n; i++) {
      const j = i + len - 1;
      dp[i][j] = Infinity;
      for (let k = i; k < j; k++) {
        dp[i][j] = Math.min(dp[i][j], dp[i][k] + dp[k + 1][j] + sum(i, j));
      }
    }
  }
  return dp[0][n - 1];
}

// ─── 测试 ─────────────────────────────────────────
console.log('=== 石子合并 ===\n');
const tests = [
  [1, 2, 3, 4], // 19
  [4, 1, 1, 4], // 18
  [3, 5, 2],    // 17
  [1, 1],       // 2
  [5],          // 0
];
for (const stones of tests) {
  console.log(`[${stones}] → ${stoneGame(stones)}`);
}
