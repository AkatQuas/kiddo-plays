/**
 * 🎒 3-3 零钱兑换（Coin Change）
 *
 * 问题：面额 coins[]（无限用），求组成 amount 的最少硬币数。
 * 无法组成则返回 -1。
 *
 * 思路：
 *   dp[a] = 组成金额 a 的最少硬币数
 *   dp[a] = min(dp[a], dp[a - c] + 1) 对每个硬币 c
 *   边界：dp[0] = 0，其他初始化为 Infinity
 *
 * 变体：
 *   组合数（LeetCode 518）：外循环硬币，内循环金额
 *   排列数（LeetCode 377）：外循环金额，内循环硬币
 *
 * ─── LeetCode 322 ─────────────────────────────────
 */

// ─── 最少硬币数 ──────────────────────────────────
function coinChange(coins: number[], amount: number): number {
  const dp: number[] = Array(amount + 1).fill(Infinity);
  dp[0] = 0;
  for (const coin of coins) {
    for (let a = coin; a <= amount; a++) {
      if (dp[a - coin] !== Infinity) {
        dp[a] = Math.min(dp[a], dp[a - coin] + 1);
      }
    }
  }
  return dp[amount] === Infinity ? -1 : dp[amount];
}

// ─── 组合数（LeetCode 518）──────────────────────────
function coinChangeCombinations(coins: number[], amount: number): number {
  const dp: number[] = Array(amount + 1).fill(0);
  dp[0] = 1;
  for (const coin of coins) {
    for (let a = coin; a <= amount; a++) {
      dp[a] += dp[a - coin];
    }
  }
  return dp[amount];
}

// ─── 排列数（LeetCode 377）──────────────────────────
function coinChangePermutations(coins: number[], amount: number): number {
  const dp: number[] = Array(amount + 1).fill(0);
  dp[0] = 1;
  for (let a = 1; a <= amount; a++) {
    for (const coin of coins) {
      if (a >= coin) dp[a] += dp[a - coin];
    }
  }
  return dp[amount];
}

// ─── 测试 ─────────────────────────────────────────
console.log('=== 零钱兑换 ===\n');
console.log('coins=[1,2,5], amount=11 →', coinChange([1,2,5], 11), '(期望 3: 5+5+1)');
console.log('coins=[2], amount=3 →', coinChange([2], 3), '(期望 -1)');
console.log('coins=[1,2,5], amount=5 组合数:', coinChangeCombinations([1,2,5], 5), '(期望 4)');
console.log('coins=[1,2,3], amount=4 排列数:', coinChangePermutations([1,2,3], 4), '(期望 7)');
