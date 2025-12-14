<!-- START doctoc generated TOC please keep comment here to allow auto update -->
<!-- DON'T EDIT THIS SECTION, INSTEAD RE-RUN doctoc TO UPDATE -->

**Table of Contents** _generated with [DocToc](https://github.com/thlorenz/doctoc)_

- [数据结构与算法之美](#%E6%95%B0%E6%8D%AE%E7%BB%93%E6%9E%84%E4%B8%8E%E7%AE%97%E6%B3%95%E4%B9%8B%E7%BE%8E)
  - [基础](#%E5%9F%BA%E7%A1%80)
  - [链表 Linked List](#%E9%93%BE%E8%A1%A8-linked-list)

<!-- END doctoc generated TOC please keep comment here to allow auto update -->

# 数据结构与算法之美

> 王争 前 Google 工程师

没错，就是这个课程，[数据结构与算法之美](https://time.geekbang.org/column/intro/100017301)，附上提供的[代码](https://github.com/wangzheng0822/algo)。

## 基础

- 复杂度分析能力，能够对算法从时间、空间两个纬度进行量级分析。

  - 时间复杂度的四种情形：最好、最坏、加权平均（期望值）
  - 特殊的加权平均，称为 “均摊复杂度”。例如在分析时间复杂度时出现 $O(1)$ 的次数远大于出现 $O(n)$ 出现的次数，那么平均平摊时间复杂度就是 $O(1)$。

- 十个基本数据结构

  - 数组
  - [链表](#linked-list)
  - [栈](#stack)
  - [队列](#queue)
  - [散列表](#hash-table)
  - [二叉树](#binary-tree)
  - 堆 / Heap
  - [跳表](#skip-list) / 可以进行二分查找的有序链表
  - 图 / Graph
  - Trie 树 / 有序树

  线性表：数组、链表、栈、队列
  非线性表：树、图

- 十个基本算法形态

  - [递归](#recursion)
  - [排序](#sort)
  - [二分查找](#binary-search)
  - 搜索
  - [哈希算法](#hash-algo)
  - 贪心算法
  - 分治算法
  - 回溯算法
  - 动态规划
  - 字符串匹配算法

<a id="#linked-list"></a>

## 链表

基本形态：

- 单向链表

  尾节点 `Tail` 的 `next` 指向 `NULL` 。

- 循环链表

  尾节点 `Tail` 的 `next` 指向 头节点 `Head` 。

- 双向链表

  节点 `Prev` 和 `next` 指向相邻的前、后节点。

- 双向循环链表

  `Tail` 的 `next` 指向 `Head`。`Head` 的 `prev` 指向 `Tail`。

哨兵节点的引入可以帮助简化很多边界情况。通常可以使用一个不带数据的伪头节点，简化操作。这个伪头节点 `next` 指向的节点是链表的真实头节点。

### 基于单向链表的 LRU 算法实现

[代码地址](./LRU-linked-list.ts)

```bash
$ npx ts-node ./LRU-linked-list.ts
```

维护一个有序单链表：越靠近链表尾部的节点是越早之前访问的，越靠近链表头部的节点是越晚访问的（即时间上最近）。

当有一个新的数据被访问时，从链表头开始顺序遍历链表。

1.如果此数据之前已经被缓存在链表中了，遍历得到这个数据对应的结点，并将其从原来的位置删除，然后将其插入到链表的头部。

2.如果此数据没有在缓存链表中，又可以分为两种情况:

    - 如果此时缓存未满，则将此结点直接插入到链表的头部;
    - 如果此时缓存已满，则链表尾结点删除，将新的数据结点插入链表的头部。

### 单链表练习题

经常用来检查链表代码是否正确的边界条件:

- 如果链表为空时，代码是否能正常工作?
- 如果链表只包含一个结点时，代码是否能正常工作?
- 如果链表只包含两个结点时，代码是否能正常工作?
- 代码逻辑在处理头结点和尾结点的时候，是否能正常工作?

| Problem                                                                                                                                        | My Solution                                      |
| :--------------------------------------------------------------------------------------------------------------------------------------------- | :----------------------------------------------- |
| [LC 206: Reverse Linked List](https://leetcode.com/problems/reverse-linked-list/)                                                              | [solution](./linked-list-revers.ts)              |
| [LC 141: Linked List Cycle](https://leetcode.com/problems/linked-list-cycle/)                                                                  | [solution](./linked-list-cycle.ts)               |
| [LC 21: Merge two sorted Lists](https://leetcode.com/problems/merge-two-sorted-lists/)                                                         | [solution](./linked-list-merge-sorted.ts)        |
| [LC 19: Remove Nth node from end of list](https://leetcode.com/problems/remove-nth-node-from-end-of-list/)                                     | [solution](./linked-list-remove-nth-from-end.ts) |
| [LC 876: Middle of the Linked List](https://leetcode.com/problems/middle-of-the-linked-list/)                                                  | [solution](./linked-list-middle.ts)              |
| [LC 237: Delete Node in a Linked List](https://leetcode.com/problems/delete-node-in-a-linked-list/)                                            | [solution](./linked-list-delete-node.ts)         |
| [LC 1290: Convert Binary Number in a Linked List to Integer](https://leetcode.com/problems/convert-binary-number-in-a-linked-list-to-integer/) | [solution](./linked-list-binary-to-decimal.ts)   |

<a id="#skip-list"></a>

### 跳表的实现

[LC 1206: Design SkipList](https://leetcode.com/problems/design-skiplist/) with [implementation in TypeScript](./skip-list.ts).

<a id="#stack"></a>

## 栈

当某个数据集合只涉及在一端插入和删除数据，并且满足后进先出、先进后出的特性，就应该首选 **栈** 这种数据结构。

用数组实现的栈，称作顺序栈；用链表实现的栈，称作链式栈。

两个栈相互倒数据，可以实现 Undo / Redo 的操作。

| Problem                                                                                                                      | My Solution                                         |
| :--------------------------------------------------------------------------------------------------------------------------- | :-------------------------------------------------- |
| [LC 20: Valid Parentheses](https://leetcode.com/problems/valid-parentheses/)                                                 | [solution](./stack-valid-parentheses.ts)            |
| [LC 844: Backspace String Compare](https://leetcode.com/problems/backspace-string-compare/)                                  | [solution](./stack-backspace-string.ts)             |
| [LC 682: Baseball game recorder](https://leetcode.com/problems/baseball-game/)                                               | [solution](./stack-baseball-game.ts)                |
| [LC 496: Next greater Element i](https://leetcode.com/problems/next-greater-element/)                                        | [solution](./stack-next-greater-element.ts)         |
| [LC 1021: Remove Outermost Parentheses](https://leetcode.com/problems/remove-outermost-parentheses/)                         | [solution](./stack-remove-outermost-parentheses.ts) |
| [LC 1544: Make The String Great](https://leetcode.com/problems/make-the-string-great/)                                       | [solution](./stack-make-string-great.ts)            |
| [LC 1598: Crawler Log Folder](https://leetcode.com/problems/crawler-log-folder/)                                             | [solution](./stack-folder-operation.ts)             |
| [LC 1618: Maximum Nesting Depth of the Parentheses](https://leetcode.com/problems/maximum-nesting-depth-of-the-parentheses/) | [solution](./stack-maximum-depth-parentheses.ts)    |
| [LC 1700: Number of Students Unable to Eat Lunch](https://leetcode.com/problems/number-of-students-unable-to-eat-lunch)      | [solution](./stack-lunch-eaten.ts)                  |

<a id="#queue"></a>

## 队列

队列是一种线性表结构，只支持两个基本操作：入队 `enqueue()`，放一个数据到队列尾部；出队 `dequeue()` ，从队列头部取一个元素。

注意判断队列 `空` 、 `满` 时的条件。在队列中，`tail` 指向的地方是没有存储任何数据的。

循环队列的 `空` 条件为 `head === tail` ；`满` 条件为 `(tail + 1) % n === head` 。循环队列中， `tail` 指向的位置没有数据，因此至少存在 1 个空位。

阻塞队列其实就是在队列基础上增加了阻塞操作。简单来说，就是在队列为空的时候，从队头取数据会被阻塞。因为此时还没有数据可取，直到队列中有了数据才能返回；如果队列已经满了，那么插入数据的操作就会被阻塞，直到队列中有空闲位置后再插入数据，然后再返回。

| Problem                                                                                 | My Solution                            |
| :-------------------------------------------------------------------------------------- | :------------------------------------- |
| [LC 933: Number of Recent Calls](https://leetcode.com/problems/number-of-recent-calls/) | [solution](./queue-number-of-calls.ts) |

<a id="#recursion"></a>

## 递归

适合使用递归方式求解的问题通常需要满足的三个条件：

1. 一个问题的解可以分解为几个子问题的解

1. 这个问题与分解之后的子问题，除了数据规模不同，求解思路完全一样

1. 存在递归终止条件

> 可以类比数学归纳法的。

写递归代码的关键就是找到如何将大问题分解为小问题的规律，并且基于此写出 **递推公式** ，然后再推敲 **终止条件**，最后将递推公式和终止条件写成代码。

在思考的时候，人脑几乎没办法把整个 “递” 和 “归” 的过程一步一步都想清楚，如果试图想搞清楚递归的每一步都是怎么执行的，这样就很容易被绕进去。

因此为了避免上述的思维误区，只需要理清相邻的 递归 过程直接的关系即可，即明确 **递推公式** ，而不要陷入多层递归之间的关系。

递归代码要警惕重复计算，可以通过计算缓存来实现节约。

| Problem                                                             | My Solution                             |
| :------------------------------------------------------------------ | :-------------------------------------- |
| [LC 143: Reorder List](https://leetcode.com/problems/reorder-list/) | [solution](./recursive-reorder-list.ts) |

<a id="#sort"></a>

## 排序

> 基于比较的排序算法的执行过程，会涉及两种操作，一种是元素比较大小，另一种是元素交换或移动。所以在分析排序算法的执行效率的时候，应该把比较次数和交换（或移动）次数也考虑进去。

|    X     |        时间复杂度        | 稳定排序 | 原地排序 |
| :------: | :----------------------: | :------: | :------: |
| 冒泡排序 |         $O(n^2)$         |    ✅    |    ✅    |
| 插入排序 |         $O(n^2)$         |    ✅    |    ✅    |
| 选择排序 |         $O(n^2)$         |    ❌    |    ✅    |
| 快速排序 |      $O(n \log n)$       |    ❌    |    ✅    |
| 归并排序 |      $O(n \log n)$       |    ✅    |    ❌    |
|  桶排序  |          $O(n)$          |    ✅    |    ❌    |
| 计数排序 | $O(n+k)$ ， $k$ 是桶个数 |    ✅    |    ❌    |
| 基数排序 |  $O(dn)$ ， $d$ 是纬度   |    ✅    |    ❌    |

### 桶排序(Bucket sort)

**算法原理**

1. 将要排序的数据按照特征划分到几个有序的桶里，每个桶里的数据再单独进行快速排序。

1. 桶内排完序之后，再把每个桶里的数据按照顺序依次取出，组成的序列就是有序的了。

**使用条件**

1. 要排序的数据需要很容易就能划分成 m 个桶，并且桶与桶之间有着天然的大小顺序。

1. 数据在各个桶之间分布是尽量均匀的。

**适用场景**

- 桶排序比较适合用在外部排序中。
- 外部排序就是数据存储在外部磁盘且数据量大，但内存有限无法将整个数据全部加载到内存中。

### 计数排序(Counting sort)

**算法原理**

- 计数其实就是桶排序的一种特殊情况。
- 当要排序的 n 个数据所处范围并不大时，比如最大值为 k，则分成 k 个桶
- 每个桶内的数据值都是相同的，就省掉了桶内排序的时间。
- 计数排序还原成原始数据的过程比较巧妙。

首先得到了每个桶对应的值的个数，然后依次累加，得到该桶位之前的数据的个数。
然后对原始数据 **从后往前** 遍历，查询该数的桶的个数，即为其位置，个数减一，遍历重复该过程。

如原始数据 `[0, 2, 0, 3, 4, 5, 3, 2]`，得到的共六个桶位为 `0,1,2,3,4,5` 。
每个桶位对应的个数为 `[2, 0, 2, 2, 1, 1]`，做累加计算得到 `[2, 2, 4, 6, 7, 8]`。 这意味着，在桶位 1 和它的之前有两个（计数），在桶位 5 和它的前面共有 8 个（计数）。
接下来，在保证稳定排序的前提，构造与原数组等长的结果数组，对原始数组从后往前遍历，遇到 数字 2， 寻得其计数为 4，因此在结果数组的地 4 个位置（index = 3）放入 2，桶计数减一。对原始数组重复过程，直到遍历结束。

**使用条件**

- 只能用在数据范围不大的场景中，若数据范围 k 比要排序的数据 n 大很多，就不适合用计数排序; （避免稀疏数组的浪费）
- 计数排序只能给非负整数排序，其他类型需要在不改变相对大小情况下，转换为非负整数;
- 如果排序数值存在小数位，需要转换为整数后排序。

> （有序的 key hashmap 可以拯救上述稀疏问题）

### 基数排序(Radix sort)

**算法原理**

- 适用于排序比较涉及多个指标，且指标有覆盖关系的情况
- 当前序指标能够明确大小关系之后，后续指标则不需要进行比较行为

(以排序 10 万个手机号为例来说明)

为了比较两个手机号码 a，b 的大小，如果在前面几位中 a 已经比 b 大了，那后面几位就不用看了。 借助稳定排序算法的思想，可以先按照最后一位来排序手机号码，然后再按照倒数第二位来重新排序，以此类推，最后按照第一个位重新排序。 经过 11 次排序后，手机号码就变为有序的了。

> 对 D，a，F，B，c，A，z 这几个字符串进行排序，要求将其中所有小写字母都排在大写字母前面，但是小写字母内部和大写字母内部不要求有序。比如经 过排序后为 a，c，z，D，F，B，A，这个如何实现呢?如果字符串中处理大小写，还有数字，将数字放在最前面，又该如何解决呢?
>
> 小写字母、大写字母、数字都是一个桶。

### 排序稳定性的意义

经过某种排序算法排序之后，如果原有的相同值的前后顺序没有改变，那我们就把这种排序算法叫作稳定的排序算法;如果前后顺序发生变化，那对应的排序算法就叫作不稳定的排序算法。

比如说，现在要给电商交易系统中的“订单”排序。订单有两个属性，分别是 _下单时间_ 和 _订单金额_ 。当前共有 10 万条订单数据，希望按照金额从小到大对订单数据排序。对于金额相同的订单，希望按照下单时间从早到晚有序。

暴力解法是：先按照金额对订单数据进行排序，然后，再遍历排序之后的订单数据，对于每个金额相同的小区间再按照下单时间排序。这种排序思路理解起来不难，但是实现起来会很复杂。

借助稳定排序算法，这个问题可以非常简洁地解决。解决思路是这样的：先按照下单时间给订单排序，排序完成之后，再用某种稳定排序算法，按照订单金额重新排序。两遍排序之后，最后得到的订单数据就是按照金额从小到大排序，金额相同的订单按照下单时间从早到晚排序的。

原因是稳定排序算法可以保持金额相同的两个对象，在排序之后的前后顺序不变。第一次排序之后，所有的订单按照下单时间从早到晚有序了。在第二次排序使用了稳定的排序算法，所以经过第二次排序之后，相同金额的订单仍然保持下单时间从早到晚有序。

<a id="#binary-search"></a>

### 变形二分查找

二分查找适用于 **已排序** **存储连续** 的一段数据

以下是几种变形处理。

<details>
<summary>数据中存在重复值时，返回第一个符合目标的值</summary>

```typescript
/**
 * Return the first target index.
 *
 * Return `-1` if not exist.
 */
function binarySearch<T>(array: T[], value: T): number {
  let high = array.length - 1;
  let low = 0;
  while (low <= high) {
    const mid = (low + (high - low)) >> 1;
    if (array[mid] > value) {
      high = mid - 1;
    } else if (array[mid] < value) {
      low = mid + 1;
    } else {
      // now array[mid] is value

      // if mid === 0, means the first value is target
      // if array[mid-1] is not value, so mid is the first match
      if (mid === 0 || array[mid - 1] !== value) {
        return mid;
      }

      // mid not 0, both array[mid-1] and array[mid] are matches
      // so the first match is between [low, mid-1]
      high = mid - 1;
    }
  }
  return -1;
}
```

</details>

<details>
<summary>数据中存在重复值时，返回最后一个符合目标的值</summary>

```typescript
/**
 * Return the last match target index.
 *
 * Return `-1` if not exist.
 */
function binarySearch<T>(array: T[], value: T): number {
  let high = array.length - 1;
  let low = 0;
  while (low <= high) {
    const mid = (low + (high - low)) >> 1;
    if (array[mid] > value) {
      high = mid - 1;
    } else if (array[mid] < value) {
      low = mid + 1;
    } else {
      // now array[mid] is value

      // if mid === n-1, means the first value is target
      // if array[mid+1] is not value, so mid is the first match
      if (mid === n - 1 || array[mid + 1] !== value) {
        return mid;
      }

      // mid not n-1, both array[mid+1] and array[mid] are matches
      // so the first match is between [mid+1, high]
      low = mid + 1;
    }
  }
  return -1;
}
```

</details>

<details>
<summary>查找第一个大于等于给定值的元素</summary>

```typescript
/**
 * Return the last match target index.
 *
 * Return `-1` if not exist.
 */
function binarySearch<T>(array: T[], value: T): number {
  let high = array.length - 1;
  let low = 0;
  while (low <= high) {
    const mid = (low + (high - low)) >> 1;
    if (array[mid] >= value) {
      // mid is 0, or
      // array[mid-1] smaller, mid is the target
      if(mid === 0 || array[mid-1] < value) {
        return mid;
      }
      //mid not 0, and array[mid-1] is not smaller
      // so the first smaller is between [low, mid-1]
      high = mid - 1;
    } else  {
      low = mid + 1;
  }
  return -1;
}

```

</details>

<details>
<summary>查找最后一个小于等于给定值的元素</summary>

```typescript
/**
 * Return the last match target index.
 *
 * Return `-1` if not exist.
 */
function binarySearch<T>(array: T[], value: T): number {
  let high = array.length - 1;
  let low = 0;
  while (low <= high) {
    const mid = (low + (high - low)) >> 1;
    if (array[mid] > value) {
      high = mid - 1;
    } else  {
      // mid is 0, or
      // array[mid-1] bigger, mid is the target
      if(mid === 0 || array[mid+1] > value) {
        return mid;
      }
      //mid not 0, and array[mid+1] is not bigger
      // so the last bigger is between [mid+1, high]
      low = mid + 1;
  }
  return -1;
}

```

</details>

<a id="#hash-table"></a>

## 散列表 Hash Table

散列冲突的解放方法？

- 开放寻址法(open addressing)

  如果出现散列冲突，就重新探测一个空闲位置，将其插入。

  探测方法有：

  - 线性探测法(Linear Probing)：逐个向后探测
  - 二次探测(Quadratic probing)：探测步长加大
  - 双重散列(Double hashing)：继续使用一组散列函数，直到找到空闲位置为止

- 链表法(chaining)

  散列槽位为链表结构。当链表长度增长到一定程度时，可以转换该链表成为 **红黑树** ，以加快增删改查的速度。

  当插入的时候，需要通过散列函数计算出对应的散列槽位，将其插入到对应的链表中即可。

### 设计一个工业级的散列表

设计目标：

- 支持快速的查询、插入、删除操作;
- 内存占用合理，不能浪费过多的内存空间;
- 性能稳定，极端情况下，散列表的性能也不会退化到无法接受的情况。

设计思路：

- 设计一个合适的散列函数;
- 定义装载因子阈值，并且设计动态扩容策略; （扩容后，旧数据的搬移策略）
- 选择合适的散列冲突解决方法。

### 散列表和链表经常放在一起使用

散列表具有快速高效的数据插入、删除和查找操作的优点，但是它无法支持快速顺序遍历散列表中的数据。链表的引入，弥补了上述缺点，使得散列表中的数据遍历变得高效。

> 那么，哪里有这样一个实例呢？

<a id="#hash-algo"></a>

## 哈希算法 Hash

将任意长度的二进制值串映射为固定长度的二进制值串，这个映射的规则就是哈希算法，而通过原始数据映射之后得到的二进制值串就是哈希值。

优秀的 hash 算法具有以下特征

- 从哈希值不能反向推导出原始数据(所以哈希算法也叫单向哈希算法);
- 对输入数据非常敏感，哪怕原始数据只修改了一个 Bit，最后得到的哈希值也大不相同;
- 散列冲突的概率要很小，对于不同的原始数据，哈希值相同的概率非常小;
- 哈希算法的执行效率要尽量高效，针对较长的文本，也能快速地计算出哈希值。

哈希算法的应用非常多，常见得有

- 安全加密：MD5 、 SHA-256 、 AES
- 唯一标识：文件内容唯一化
- 数据校验：文件内容 MD5 值比对
- 散列函数：可应用于散列表的实现
- 负载均衡：客户端的信息哈希之后到特定服务器，实现粘滞和均衡
- 数据分片：取模行为确定数据分块位置
- 分布式存储：类似数据分片，决定存储在某个机器上 (一致性哈希算法)

<a id="#binary-tree"></a>

## 二叉树 Binary tree

二叉树，每个节点最多有两个子节点，分别是左子节点和右子节点。不过，二叉树并不要求每个节点都有两个子节点，有的节点只有左子节点，有的节点只有右子节点。

叶子节点全都在最底层，除了叶子节点之外，每个节点都有左右两个子节点，这种二叉树称为满二叉树。

叶子节点都在最底下两层，最后一层的叶子节点都靠左排列，并且除了最后一层，其他层的节点个数都要达到最大，这种二叉树称为完全二叉树。

**存储形式**

- 基于指针或者引用的二叉链式存储法；
- 基于数组的顺序存储法。

对于二叉树的数组存储形态，如果节点 X 存储在数组中下标为 i 的位置，那么下标为 2 \* i 的位置存储的就是左子节点，下标为 2 \* i + 1 的位置存储的就是右子节点。反过来，下标为 i/2 的位置存储就是它的父节点。

通过这种方式，只要知道根节点存储的位置，结合下标计算，就能够把整棵树都串起来。(一般情况下，为了方便计算子节点，根节点会存储在下标为 1 的位置，下标为 0 的位置空掉)。

如果不是满二叉树或者完全二叉树，数组存储将会变得稀疏，造成空间浪费。

> 如果某棵二叉树是一棵完全二叉树，那用数组存储无疑是最节省内存的一种方式。
>
> 堆其实就是一种完全二叉树，最常用的存储方式就是数组。

**三种主要遍历形态**

前序遍历是指，对于树中的任意节点来说，先处理这个节点，然后再处理它的左子树，最后处理它的右子树。

中序遍历是指，对于树中的任意节点来说，先处理它的左子树，然后再处理它本身，最后处理它的右子树。

后序遍历是指，对于树中的任意节点来说，先处理它的左子树，然后再处理它的右子树，最后处理这个节点本身。

> 层遍历，每一层的值逐个遍历。AKA 一个广度优先的遍历算法。

### 二叉查找树 Binary Search Tree

二叉查找树的查找、插入操作都比较简单易懂，但是它的删除操作就比较复杂了。

针对要删除节点的子节点个数的不同，分三种情况来处理：

- 第一种情况是，如果要删除的节点没有子节点，只需要直接将它的父节点中，指向要删除节点的指针置为 null。

- 第二种情况是，如果要删除的节点只有一个子节点(只有左子节点或者右子节点)，只需要更新父节点中，指向要删除节点的指针，让七指向要删除节点的子节点就可以了。

- 第三种情况是，如果要删除的节点有两个子节点，情况比较复杂了。需要找到这个节点的右子树中的最小节点，把它替换到要删除的节点上。然后再删除掉这个最小节点。

<details>
<summary>删除代码实现</summary>

```typescript
interface DataNode<T> {
  value: T;
  left: DataNode<T> | null;
  right: DataNode<T> | null;
}
function remove<T>(node: DataNode<T> | null, value: T) {
  type TreeNode = typeof node;
  if (node === null) {
    return;
  }

  let p: TreeNode = node; // iterator
  let pp: TreeNode = null; // parent for p
  while (p !== null && p.value !== value) {
    pp = p;
    if (value > p.value) {
      p = p.right;
    } else {
      p = p.left;
    }
  }

  // not found, no need to remove
  if (p === null) {
    return;
  }

  if (p.left !== null && p.right !== null) {
    let minP: TreeNode = p.right;
    let minPP: TreeNode = p; // parent for minP
    while (minP.left !== null) {
      minPP = minP;
      minP = minP.left;
    }

    // replace the target one with the smaller in right child
    // replace the value, rather than the reference
    p.value = minP.value;

    // now need to remove that right-smaller one
    p = minP;
    pp = minPP;
  }

  let child: TreeNode = null;
  if (p.left !== null) {
    child = p.left;
  } else if (p.right !== null) {
    child = p.right;
  }

  if (pp === null) {
    // remove the root node
    node = child;
  } else if (pp.left === p) {
    pp.left = child;
  } else {
    pp.right = child;
  }
}
```

</details>

二叉查找树还有一个有用特性就是可以通过中序遍历二叉查找树输出有序的数据序列，时间复杂度是 $O(n)$，非常高效。因此，二叉查找树也叫作二叉排序树。

平衡二叉树的 _严格定义_ 是这样的：二叉树中任意一个节点的左右子树的高度相差不能大于 1 。

平衡二叉查找树中“平衡”的意思，其实就是让整棵树左右看起来比较 _对称_ 、比较 _平衡_ ，不要出现左子树很高、右子树很矮的情况。这样就能让整棵树的高度相对来说低一些，相应的插入、删除、查找等操作的效率高一些。

#### 红黑树

红黑树 Red-Black Tree ，简称 R-B Tree 。它是一种不严格的平衡二叉查找树。

红黑树中的节点，一类被标记为黑色，一类被标记为红色。除此之外，一棵红黑树还需要满足这样几个要求：

- 根节点是黑色的；
- 每个叶子节点都是黑色的空节点(NIL)，也就是说，叶子节点不存储数据；
- 任何相邻的节点都不能同时为红色，也就是说，红色节点是被黑色节点隔开的；
- 每个节点，从该节点到达其可达叶子节点的所有路径，都包含相同数目的黑色节点。

在插入、删除节点的过程中，第三、第四点要求可能会被破坏，通过 _平衡调整_ ，实际上就是要把被破坏的第三、第四点恢复过来。

**左旋(rotate left)和右旋(rotate right)**。

左旋全称其实是叫围绕某个节点的左旋，那右旋的全称就叫围绕某个节点的右旋。

> TBC
