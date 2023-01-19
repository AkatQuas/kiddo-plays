/*
  AsyncSeriesWaterfallHook
  顺序执行
  每个函数均需要返回 promise ，或者以 async function 执行
  每个函数入参一致，前序函数返回值传递给下一个
  如果某个函数返回 undefined，则下一个函数的入参是上一个有效的返回值，关注 fn2.5
  整体 promise 函数 then 入参为最后一个结果有效结果值，且执行过程中任意 reject error 可以被 catch 捕获
*/
import { AsyncSeriesWaterfallHook } from 'tapable';

// 创建实例
const asyncSeriesWaterfallHook = new AsyncSeriesWaterfallHook(['name', 'age']);

// 注册事件
asyncSeriesWaterfallHook.tapPromise('fn1', (name, age) => {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      console.log('fn1', name, age, new Date());
      resolve(name + '_append1');
    }, 200);
  });
});
asyncSeriesWaterfallHook.tapPromise('fn1.5', async (name, age) => {
  return new Promise((resolve, reject) => {
    setTimeout(
      () => (
        console.log('fn1.5'),
        Math.random() > 0.7 ? resolve(name + '_append1.5') : reject()
      ),
      100
    );
  });
});
asyncSeriesWaterfallHook.tapPromise('fn2', (name, age) => {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      console.log('fn2', name, age, new Date());
      resolve('never_append3');
      // 假设 fn3 返回 undefined
      // 整体 promise 的 result 是最后一个有效结果值，即 "tapable_append1_append1.5"
    }, 400);
  });
});

console.time('time');
// 触发事件，让监听函数执行
asyncSeriesWaterfallHook
  .promise('tapable', 18)
  .then((result) => {
    console.log('complete', { result });
    console.timeEnd('time');
  })
  .catch((e) => {
    // 捕获对应错误
    console.debug('\x1B[97;101;1m --- Error --- \x1B[m', '\n', e);
  });

// 成功示例
// fn1 tapable 18 2023-01-16T07:06:47.102Z
// fn1.5
// fn2 tapable_append1_append1.5 18 2023-01-16T07:06:51.229Z
// complete { result: 'never_append3' }
// time: 737.33ms

// 报错示例
// fn1 tapable 18 2023-01-16T07:07:53.204Z
// fn1.5
