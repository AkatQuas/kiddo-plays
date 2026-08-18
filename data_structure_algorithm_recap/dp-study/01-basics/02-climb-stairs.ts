/**
 * 📘 1-2 爬楼梯
 *
 * 问题：一次可以爬 1 阶或 2 阶，爬到 n 阶有多少种方法？
 *
 * 思路：最后一步要么从 n-1 跨 1 阶，要么从 n-2 跨 2 阶。
 *   dp[i] = dp[i-1] + dp[i-2]
 *   边界：dp[1] = 1, dp[2] = 2
 *
 * 扩展：如果一次可以爬 1,2,3 阶？
 *   dp[i] = dp[i-1] + dp[i-2] + dp[i-3]
 *
 * ────────────────────────────────────────────────────
 */

// ─── 基础 DP ──────────────────────────────────────
function climbStairs(n: number): number {
  if (n <= 2) return n;
  const dp: number[] = [];
  dp[0] = 0;
  dp[1] = 1;
  dp[2] = 2;
  for (let i = 3; i <= n; i++) {
    dp[i] = dp[i - 1] + dp[i - 2];
  }
  return dp[n];
}

// ─── 空间优化 ─────────────────────────────────────
function climbStairsOpt(n: number): number {
  if (n <= 2) return n;
  let prev2 = 1, prev1 = 2;
  for (let i = 3; i <= n; i++) {
    const cur = prev1 + prev2;
    prev2 = prev1;
    prev1 = cur;
  }
  return prev1;
}

// ─── 扩展：可爬 1,2,3 阶 ──────────────────────────
function climbStairs3(n: number): number {
  if (n <= 1) return n;
  if (n === 2) return 2;
  if (n === 3) return 4;
  const dp: number[] = [];
  dp[1] = 1; dp[2] = 2; dp[3] = 4;
  for (let i = 4; i <= n; i++) {
    dp[i] = dp[i - 1] + dp[i - 2] + dp[i - 3];
  }
  return dp[n];
}

// ─── 测试 ─────────────────────────────────────────
console.log('=== 爬楼梯 ===\n');
for (let n = 1; n <= 10; n++) {
  console.log(`${n} 阶 → ${climbStairs(n)} 种方法`);
}
console.log('\n--- 扩展（1,2,3 步）---');
for (let n = 1; n <= 10; n++) {
  console.log(`${n} 阶 → ${climbStairs3(n)} 种方法`);
}
