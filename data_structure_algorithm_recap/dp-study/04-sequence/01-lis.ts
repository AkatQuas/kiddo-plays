/**
 * 🧬 4-1 最长递增子序列（LIS）
 *
 * 问题：给定数组，找最长严格递增子序列的长度（不要求连续，顺序不变）
 *
 * 思路（O(n²) DP）：
 *   dp[i] = 以 nums[i] 结尾的 LIS 长度
 *   对每个 i，看前面 j < i，如果 nums[j] < nums[i]，则 dp[i] = max(dp[i], dp[j] + 1)
 *   每个元素至少为 1
 *
 * 进阶（O(n log n) 二分）：
 *   维护 tails[k] = 长度为 k+1 的递增子序列的末尾最小值
 *   对每个 x 二分查找第一个 >= x 的位置替换
 *   tails 不一定是 LIS，但长度 = LIS 长度
 *
 * ─── LeetCode 300 ─────────────────────────────────
 */

// ─── O(n²) DP ─────────────────────────────────────
function lengthOfLIS(nums: number[]): number {
  const n = nums.length;
  if (n === 0) return 0;
  const dp: number[] = Array(n).fill(1);
  let maxLen = 1;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < i; j++) {
      if (nums[j] < nums[i]) dp[i] = Math.max(dp[i], dp[j] + 1);
    }
    maxLen = Math.max(maxLen, dp[i]);
  }
  return maxLen;
}

// ─── O(n log n) 贪心 + 二分 ───────────────────────
function lengthOfLISFast(nums: number[]): number {
  const tails: number[] = [];
  for (const x of nums) {
    let l = 0, r = tails.length;
    while (l < r) {
      const m = (l + r) >> 1;
      if (tails[m] < x) l = m + 1;
      else r = m;
    }
    if (l === tails.length) tails.push(x);
    else tails[l] = x;
  }
  return tails.length;
}

// ─── 测试 ─────────────────────────────────────────
console.log('=== 最长递增子序列 ===\n');
const cases = [
  [10,9,2,5,3,7,101,18], // [2,3,7,101] → 4
  [0,1,0,3,2,3],          // [0,1,2,3] → 4
  [7,7,7,7],              // 严格递增 → 1
];
for (const nums of cases) {
  console.log(`[${nums}] → LIS = ${lengthOfLIS(nums)}（二分: ${lengthOfLISFast(nums)}）`);
}
