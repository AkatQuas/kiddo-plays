/**
 * 🧬 4-3 编辑距离（Edit Distance）
 *
 * 问题：word1 → word2，可通过插入、删除、替换三种操作，求最少操作次数。
 *
 * 思路：
 *   dp[i][j] = word1[0..i-1] → word2[0..j-1] 的最小编辑距离
 *   如果 word1[i-1] == word2[j-1]：dp[i][j] = dp[i-1][j-1]
 *   否则：
 *     dp[i][j] = min(
 *       dp[i-1][j] + 1,     // 删除 word1[i-1]
 *       dp[i][j-1] + 1,     // 插入 word2[j-1]
 *       dp[i-1][j-1] + 1    // 替换
 *     )
 *   边界：dp[i][0] = i, dp[0][j] = j
 *
 * 学习点：LCS + 三种操作代价。搜索引擎拼写纠正、DNA 比对的基础。
 *
 * ─── LeetCode 72 ─────────────────────────────────
 */

function minDistance(word1: string, word2: string): number {
  const m = word1.length, n = word2.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 1; i <= m; i++) dp[i][0] = i;
  for (let j = 1; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (word1[i - 1] === word2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + 1);
      }
    }
  }
  return dp[m][n];
}

// ─── 测试 ─────────────────────────────────────────
console.log('=== 编辑距离 ===\n');
const tests: [string, string][] = [
  ['horse', 'ros'],
  ['intention', 'execution'],
  ['', 'a'],
  ['abc', 'abc'],
];
for (const [w1, w2] of tests) {
  console.log(`'${w1}' → '${w2}' = ${minDistance(w1, w2)} 步`);
}
