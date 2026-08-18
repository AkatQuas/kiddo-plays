# 🎯 动态规划从零到中级

> 循序渐进

从零开始，通过 **16 个可运行的 TS 文件** 逐步掌握动态规划的核心模式。每个文件独立可执行，也可在 Web 界面中阅读。

---

## 🚀 快速开始

```bash
cd dp-study
npm install

# 终端模式：直接运行单个文件
npx tsx 01-basics/01-fibonacci.ts

# Web 模式：带代码高亮的交互式学习界面
npm run dev
# → 打开 http://localhost:5173
```

---

## 📋 目录结构

```
dp-study/
├── src/                  # Web 界面 (Vite + Preact)
│   ├── components/       # 侧栏、内容区、解析器
│   ├── style.css         # 双栏布局样式
│   ├── sections.json     # 由 scripts/generate-sections.ts 自动生成
│   ├── app.tsx           # 主应用
│   └── main.tsx          # 入口
├── scripts/
│   └── generate-sections.ts   # 扫描 .ts 文件生成 sections.json
│
├── 01-basics/            # 📘 基础篇
│   ├── 01-fibonacci.ts      # 递推 → 记忆化 → DP 对比
│   ├── 02-climb-stairs.ts   # 爬楼梯：计数型 DP 入门
│   └── 03-min-cost-climb.ts # 最小花费爬楼梯：求最值
│
├── 02-2d-grid/           # 📐 二维网格
│   ├── 01-unique-paths.ts   # 唯一路径数（二维 DP）
│   └── 02-min-path-sum.ts   # 最小路径和（滚动数组优化）
│
├── 03-knapsack/          # 🎒 背包问题
│   ├── 01-01-knapsack.ts    # 0/1 背包（选/不选决策模型）
│   ├── 02-unbounded.ts      # 完全背包（容量遍历方向对比）
│   └── 03-coin-change.ts    # 零钱兑换 + 组合/排列数
│
├── 04-sequence/          # 🧬 序列问题
│   ├── 01-lis.ts            # 最长递增子序列 O(n²) + O(n log n)
│   ├── 02-lcs.ts            # 最长公共子序列（双序列 DP）
│   └── 03-edit-distance.ts  # 编辑距离（三种操作代价）
│
├── 05-interval/          # 🔗 区间 DP
│   ├── 01-palindrome.ts     # 最长回文子序列
│   └── 02-stone-game.ts     # 石子合并（枚举分割点）
│
├── 06-advanced/          # 🚀 进阶模式
│   ├── 01-tree-dp.ts        # 树形 DP（打家劫舍 III）
│   ├── 02-bitmask-dp.ts     # 状态压缩 DP（TSP）
│   └── 03-digit-dp.ts       # 数位 DP（不含 4 计数）
│
├── package.json
├── tsconfig.json
├── vite.config.ts
└── README.md             # ← 你在这里
```

---

## 🧠 学习路径（6 阶段）

| 阶段 | 名称     | 核心概念                     | 难度       |
| ---- | -------- | ---------------------------- | ---------- |
| 1    | 基础     | 递推、记忆化、状态定义       | ⭐⭐       |
| 2    | 二维网格 | 多维度状态、滚动数组优化     | ⭐⭐       |
| 3    | 背包     | 选/不选、容量维度、完全/有限 | ⭐⭐⭐     |
| 4    | 序列     | 双序列、LCS、编辑距离        | ⭐⭐⭐     |
| 5    | 区间     | 区间划分、枚举分割点         | ⭐⭐⭐⭐   |
| 6    | 进阶     | 树形、状态压缩、数位 DP      | ⭐⭐⭐⭐⭐ |

---

## 💡 学习方法建议

1. **按顺序学** — 每个文件依赖前面的概念，不要跳
2. **先读题目** — 每个文件头部 JSDoc 包含了问题描述和思路公式
3. **再读代码** — 看懂状态转移方程后再看实现
4. **改参数再跑** — `npx tsx <文件>` 修改参数观察输出变化
5. **画表格** — DP 的核心是填表，动笔在纸上画出来
6. **Web 界面** — `npm run dev` 打开浏览器，左栏题目 + 右栏代码并排阅读

## 🔑 核心心法

```
DP = 暴力搜索 + 备忘录（记忆化）
   = 最优子结构 + 重叠子问题
   = 状态定义 + 状态转移方程 + 边界条件
```

---

## Scripts

| `npm run ...` | 用途                                |
| ------------- | ----------------------------------- |
| `dev`         | 启动 Vite 开发服务器                |
| `build`       | 构建生产版本                        |
| `typecheck`   | TypeScript 类型检查（仅 src/）      |
| `generate`    | 重新扫描 .ts 文件生成 sections.json |
| `preview`     | 预览构建后的版本                    |

---

> 学完 6 阶段 ≈ 掌握 80% 面试 DP 题型
