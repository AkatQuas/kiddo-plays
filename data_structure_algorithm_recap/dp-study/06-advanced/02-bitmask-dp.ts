/**
 * 🚀 6-2 状态压缩 DP（Bitmask DP）
 *
 * 问题：旅行商问题（TSP）—— n 个城市距离矩阵，从 0 出发每个城市
 * 恰好访问一次，最后回到 0，求最短路径。
 *
 * 思路：
 *   dp[mask][i] = 已访问城市集合为 mask，当前在 i 的最小距离
 *   mask 是一个整数，第 k 位 = 1 表示访问过城市 k
 *   dp[mask][i] = min(dp[mask ^ (1<<i)][j] + dist[j][i])
 *   边界：dp[1][0] = 0
 *   答案：min(dp[full][i] + dist[i][0])
 *
 * 适用条件：n ≤ 20（2²⁰ ≈ 1M 状态可接受）
 *
 * ────────────────────────────────────────────────────
 */

function tsp(dist: number[][]): number {
  const n = dist.length;
  const total = 1 << n;
  const dp: number[][] = Array.from({ length: total }, () => Array(n).fill(Infinity));
  dp[1][0] = 0;
  for (let mask = 1; mask < total; mask++) {
    if ((mask & 1) === 0) continue;
    for (let i = 0; i < n; i++) {
      if ((mask & (1 << i)) === 0) continue;
      const prev = mask ^ (1 << i);
      for (let j = 0; j < n; j++) {
        if ((prev & (1 << j)) === 0) continue;
        dp[mask][i] = Math.min(dp[mask][i], dp[prev][j] + dist[j][i]);
      }
    }
  }
  const full = total - 1;
  let ans = Infinity;
  for (let i = 1; i < n; i++) ans = Math.min(ans, dp[full][i] + dist[i][0]);
  return ans;
}

// ─── 测试 ─────────────────────────────────────────
console.log('=== 状态压缩 DP：TSP ===\n');
const dist = [
  [0, 10, 15, 20],
  [10, 0, 35, 25],
  [15, 35, 0, 30],
  [20, 25, 30, 0],
];
console.log('4 城市 TSP:', tsp(dist), '(期望 80: 0→1→3→2→0)');
