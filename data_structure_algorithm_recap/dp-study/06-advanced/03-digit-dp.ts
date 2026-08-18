/**
 * 🚀 6-3 数位 DP（Digit DP）
 *
 * 问题：统计 [1, n] 范围内不含数字 4 的数字个数。
 *
 * 思路：
 *   将数字转成位数组，DFS 按位处理：
 *     dfs(pos, tight, has4)
 *        pos: 当前位（高位到低位）
 *        tight: 是否贴着 n 的上界
 *        has4: 是否已有数字 4
 *   记忆化 (pos, tight, has4) 避免重复计算。
 *
 * 统计 [L, R] = count(R) - count(L-1)
 *
 * 适用场景：大范围数字统计，n 可达 10¹⁸
 *
 * ────────────────────────────────────────────────────
 */

function countWithoutFour(n: number): number {
  const digits = String(n).split('').map(Number);
  const memo = new Map<string, number>();
  function dfs(pos: number, tight: boolean, has4: boolean): number {
    if (pos === digits.length) return has4 ? 0 : 1;
    const key = `${pos}_${tight}_${has4}`;
    if (memo.has(key)) return memo.get(key)!;
    const limit = tight ? digits[pos] : 9;
    let total = 0;
    for (let d = 0; d <= limit; d++) {
      total += dfs(pos + 1, tight && d === limit, has4 || d === 4);
    }
    memo.set(key, total);
    return total;
  }
  return dfs(0, true, false) - 1; // 减 0
}

function countRangeWithoutFour(L: number, R: number): number {
  return countWithoutFour(R) - countWithoutFour(L - 1);
}

// ─── 测试 ─────────────────────────────────────────
console.log('=== 数位 DP：不含 4 ===\n');
console.log('[1, 10] :', countWithoutFour(10), '(期望 9)');
console.log('[1, 100] :', countWithoutFour(100), '(期望 81)');
console.log('[4, 15]  :', countRangeWithoutFour(4, 15), '(期望 10: 4,14 排除)');
console.log('[1, 1000]:', countWithoutFour(1000), '(期望 729)');
