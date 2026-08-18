/**
 * 📘 1-1 斐波那契数列
 *
 * 问题：计算斐波那契数列的第 n 项。
 *   F(0) = 0, F(1) = 1
 *   F(n) = F(n-1) + F(n-2)
 *
 * 学这个的目的：DP 的 Hello World。
 * 展示 DP 的三个核心要素：
 *   ① 状态定义 —— dp[i] 表示第 i 个斐波那契数
 *   ② 状态转移方程 —— dp[i] = dp[i-1] + dp[i-2]
 *   ③ 边界条件 —— dp[0] = 0, dp[1] = 1
 *
 * 先做对比实验：暴力递归 vs 记忆化 vs DP，感受速度差异。
 *
 * ────────────────────────────────────────────────────
 */

// ─── 方法 1：暴力递归（指数级） ─────────────────────
// fib(45) 跑 5~15 秒，fib(50) 数分钟
function fibBrute(n: number): number {
  if (n <= 1) return n;
  return fibBrute(n - 1) + fibBrute(n - 2);
}
// 原因：重复计算了巨量子问题

// ─── 方法 2：记忆化递归（自顶向下） ─────────────────
// 用缓存存算过的结果
function fibMemo(n: number, memo: number[] = []): number {
  if (n <= 1) return n;
  if (memo[n] !== undefined) return memo[n];
  memo[n] = fibMemo(n - 1, memo) + fibMemo(n - 2, memo);
  return memo[n];
}

// ─── 方法 3：自底向上 DP ───────────────────────────
// 从小到大填表
function fibDp(n: number): number {
  if (n <= 1) return n;
  const dp: number[] = [0, 1];
  for (let i = 2; i <= n; i++) {
    dp[i] = dp[i - 1] + dp[i - 2];
  }
  return dp[n];
}

// ─── 方法 4：空间优化 DP ──────────────────────────
// 只存前两个值，O(1) 空间
function fibOpt(n: number): number {
  if (n <= 1) return n;
  let prev2 = 0, prev1 = 1;
  for (let i = 2; i <= n; i++) {
    const cur = prev1 + prev2;
    prev2 = prev1;
    prev1 = cur;
  }
  return prev1;
}

// ─── 测试 ─────────────────────────────────────────
const N = 45;
console.log('=== 对比实验：为什么 DP 比暴力递归快？ ===\n');

console.time('② 记忆化递归');
console.log('fibMemo(45) =', fibMemo(N));
console.timeEnd('② 记忆化递归');

console.time('③ 自底向上 DP');
console.log('fibDp(45)   =', fibDp(N));
console.timeEnd('③ 自底向上 DP');

console.time('④ 空间优化 DP');
console.log('fibOpt(45)  =', fibOpt(N));
console.timeEnd('④ 空间优化 DP');

console.log('\n① 暴力递归没跑——指数爆炸 O(2ⁿ)');
console.log('结论：DP = 空间换时间，消除重复计算');
