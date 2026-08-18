/**
 * 📐 2-1 唯一路径数（Unique Paths）
 *
 * 问题：m×n 网格，从左上走到右下，只能向右或向下，有多少条路？
 *
 * 思路：
 *   到 (i,j) 的最后一步要么从 (i-1,j) 向下，要么从 (i,j-1) 向右。
 *   dp[i][j] = dp[i-1][j] + dp[i][j-1]
 *   边界：第一行和第一列都只有 1 种走法
 *
 * 学习点：一维 DP → 二维 DP 的第一次跨越。
 * 空间优化技巧：滚动数组（一维数组行行更新）
 *
 * ────────────────────────────────────────────────────
 */

// ─── 二维 DP ──────────────────────────────────────
function uniquePaths(m: number, n: number): number {
  const dp: number[][] = Array.from({ length: m }, () => Array(n).fill(0));
  for (let j = 0; j < n; j++) dp[0][j] = 1;
  for (let i = 0; i < m; i++) dp[i][0] = 1;
  for (let i = 1; i < m; i++) {
    for (let j = 1; j < n; j++) {
      dp[i][j] = dp[i - 1][j] + dp[i][j - 1];
    }
  }
  return dp[m - 1][n - 1];
}

// ─── 空间优化：滚动数组 ───────────────────────────
function uniquePathsOpt(m: number, n: number): number {
  const dp: number[] = Array(n).fill(1);
  for (let i = 1; i < m; i++) {
    for (let j = 1; j < n; j++) {
      dp[j] = dp[j] + dp[j - 1];
    }
  }
  return dp[n - 1];
}

// ─── 测试 ─────────────────────────────────────────
console.log('=== 唯一路径数 ===\n');
const tests: [number, number][] = [
  [3, 7],
  [3, 2],
  [3, 3],
  [1, 1],
];
for (const [m, n] of tests) {
  console.log(
    `${m}×${n} → ${uniquePaths(m, n)}（空间优化: ${uniquePathsOpt(m, n)}）`
  );
}
