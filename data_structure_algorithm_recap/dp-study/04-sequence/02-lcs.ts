/**
 * 🧬 4-2 最长公共子序列（LCS）
 *
 * 问题：两个字符串 text1、text2，求最长公共子序列长度。
 *
 * 思路：
 *   dp[i][j] = text1[0..i-1] 和 text2[0..j-1] 的 LCS 长度
 *   如果 text1[i-1] == text2[j-1]：dp[i][j] = dp[i-1][j-1] + 1
 *   否则：dp[i][j] = max(dp[i-1][j], dp[i][j-1])
 *   边界：dp[0][*] = 0, dp[*][0] = 0
 *
 * 学习点：双序列 DP 的经典代表。编辑距离、最长回文子序列都是它的变体。
 *
 * ─── LeetCode 1143 ────────────────────────────────
 */

// ─── 二维 DP ──────────────────────────────────────
function longestCommonSubsequence(text1: string, text2: string): number {
  const m = text1.length, n = text2.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (text1[i - 1] === text2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }
  return dp[m][n];
}

// ─── 空间优化 ─────────────────────────────────────
function longestCommonSubsequenceOpt(text1: string, text2: string): number {
  const m = text1.length, n = text2.length;
  if (n > m) return longestCommonSubsequenceOpt(text2, text1);
  const dp: number[] = Array(n + 1).fill(0);
  for (let i = 1; i <= m; i++) {
    let prev = 0;
    for (let j = 1; j <= n; j++) {
      const temp = dp[j];
      if (text1[i - 1] === text2[j - 1]) dp[j] = prev + 1;
      else dp[j] = Math.max(dp[j], dp[j - 1]);
      prev = temp;
    }
  }
  return dp[n];
}

// ─── 测试 ─────────────────────────────────────────
console.log('=== 最长公共子序列 ===\n');
const tests: [string, string][] = [
  ['abcde', 'ace'],
  ['abc', 'abc'],
  ['abc', 'def'],
  ['ezupkr', 'ubmrapg'],
];
for (const [s1, s2] of tests) {
  console.log(`'${s1}' vs '${s2}' → LCS = ${longestCommonSubsequence(s1, s2)}`);
}
