/*
  AsyncParallelHook
  异步并行执行

  每个 hook 函数应当返回 promise 或者以 async function 执行

  每个函数之间执行互不影响。

  第一个抛出 Error 的 promise 会被 catch 捕获。后续 Error 不再触发。

  即使所有回调均正常执行时， callAsync 最后的 result 也为 undefined 。
*/
import { AsyncParallelHook } from 'tapable';

// 创建实例
let asyncParallelHook = new AsyncParallelHook(['name', 'age']);

// 注册事件
asyncParallelHook.tapPromise('fn1', (name, age) => {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      console.log('fn1', name, age, new Date());
      resolve();
    }, 200);
  });
});

asyncParallelHook.tapPromise('fn2', async (name, age, callback) => {
  console.log('fn2', name, age, new Date());
  await new Promise((resolve, reject) => {
    setTimeout(() => {
      Math.random() > 0.8 ? resolve() : reject();
    }, 300);
  });
});
asyncParallelHook.tapPromise('fn3', (name, age, callback) => {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      console.log('fn3', name, age, new Date());
      resolve('3');
    }, 400);
  });
});

// 触发事件，让监听函数执行
console.time('time');
asyncParallelHook
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
// fn2 tapable 18 2023-01-16T11:26:34.926Z
// fn1 tapable 18 2023-01-16T11:26:35.131Z
// fn3 tapable 18 2023-01-16T11:26:35.338Z
// complete { result: undefined }
// time: 414.527ms

// 报错示例
// fn2 tapable 18 2023-01-16T11:26:16.572Z
//  --- Error ---
//  undefined
// fn1 tapable 18 2023-01-16T11:26:18.576Z
// fn3 tapable 18 2023-01-16T11:26:20.583Z
