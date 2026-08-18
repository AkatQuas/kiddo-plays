/**
 * 📐 2-2 最小路径和（Minimum Path Sum）
 *
 * 问题：m×n 网格，每个格子有非负整数，找左上到右下的路径，
 * 只能向右或向下，使路径数字之和最小。
 *
 * 思路：
 *   dp[i][j] = min(dp[i-1][j], dp[i][j-1]) + grid[i][j]
 *   边界：第一行只能从左来，第一列只能从上面来
 *
 * 学习点："计数"→"求最值"的二维版本。
 * 和 爬楼梯 → 最小花费爬楼梯 是同一思路升级。
 *
 * ─── LeetCode 64 ─────────────────────────────────
 */

function minPathSum(grid: number[][]): number {
  const m = grid.length, n = grid[0].length;
  const dp: number[][] = Array.from({ length: m }, () => Array(n).fill(0));
  dp[0][0] = grid[0][0];
  for (let j = 1; j < n; j++) dp[0][j] = dp[0][j - 1] + grid[0][j];
  for (let i = 1; i < m; i++) dp[i][0] = dp[i - 1][0] + grid[i][0];
  for (let i = 1; i < m; i++) {
    for (let j = 1; j < n; j++) {
      dp[i][j] = Math.min(dp[i - 1][j], dp[i][j - 1]) + grid[i][j];
    }
  }
  return dp[m - 1][n - 1];
}

// ─── 空间优化 ─────────────────────────────────────
function minPathSumOpt(grid: number[][]): number {
  const m = grid.length, n = grid[0].length;
  const dp: number[] = Array(n).fill(0);
  dp[0] = grid[0][0];
  for (let j = 1; j < n; j++) dp[j] = dp[j - 1] + grid[0][j];
  for (let i = 1; i < m; i++) {
    dp[0] = dp[0] + grid[i][0];
    for (let j = 1; j < n; j++) {
      dp[j] = Math.min(dp[j], dp[j - 1]) + grid[i][j];
    }
  }
  return dp[n - 1];
}

// ─── 测试 ─────────────────────────────────────────
console.log('=== 最小路径和 ===\n');
const grid1 = [[1,3,1],[1,5,1],[4,2,1]];
console.log('网格:', grid1);
console.log('最小路径和:', minPathSum(grid1), '(期望 7)');
