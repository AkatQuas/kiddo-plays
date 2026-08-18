/**
 * 🔗 5-1 最长回文子序列（Longest Palindromic Subsequence）
 *
 * 问题：给定字符串 s，找最长回文子序列长度（不要求连续，顺序不变）
 *
 * 思路：
 *   dp[i][j] = s[i..j] 的最长回文子序列长度
 *   如果 s[i] == s[j]：dp[i][j] = dp[i+1][j-1] + 2
 *   否则：dp[i][j] = max(dp[i+1][j], dp[i][j-1])
 *   边界：dp[i][i] = 1
 *
 * 学习点：区间 DP 入门。大区间由小区间推导。
 * 遍历顺序：i 从大到小，j 从小到大（因为依赖 i+1 和 j-1）
 *
 * ─── LeetCode 516 ─────────────────────────────────
 */

function longestPalindromeSubseq(s: string): number {
  const n = s.length;
  if (n <= 1) return n;
  const dp: number[][] = Array.from({ length: n }, () => Array(n).fill(0));
  for (let i = 0; i < n; i++) dp[i][i] = 1;
  for (let i = n - 1; i >= 0; i--) {
    for (let j = i + 1; j < n; j++) {
      if (s[i] === s[j]) {
        dp[i][j] = (i + 1 <= j - 1 ? dp[i + 1][j - 1] : 0) + 2;
      } else {
        dp[i][j] = Math.max(dp[i + 1][j], dp[i][j - 1]);
      }
    }
  }
  return dp[0][n - 1];
}

// ─── 测试 ─────────────────────────────────────────
console.log('=== 最长回文子序列 ===\n');
const tests = ['bbbab', 'cbbd', 'a', 'aabaa'];
for (const s of tests) {
  console.log(`'${s}' → ${longestPalindromeSubseq(s)}`);
}
