/*
  AsyncSeriesBailHook
  顺序执行
  每个函数均需要返回 promise ，或者以 async function 执行
  每个函数入参一致，一旦某个返回值非 undefined，中断后续执行
  整体 promise 函数入参为 undefined，且执行过程中任意 reject error 可以被 catch 捕获
*/

import { AsyncSeriesBailHook } from 'tapable';

// 创建实例
const asyncSeriesBailHook = new AsyncSeriesBailHook(['name', 'age']);

// 注册事件
asyncSeriesBailHook.tapPromise('fn1', (name, age) => {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      console.log('fn1', name, age, new Date());
      resolve(undefined);
    }, 200);
  });
});
asyncSeriesBailHook.tapPromise('fn1.5', async (name, age) => {
  return new Promise((resolve, reject) => {
    setTimeout(
      () => (
        console.log('fn1.5'), Math.random() > 0.7 ? resolve('1.5') : reject()
      ),
      100
    );
  });
});

asyncSeriesBailHook.tapPromise('fn2', (name, age) => {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      console.log('fn2', name, age, new Date());
      resolve();
    }, 400);
  });
});

console.time('time');
// 触发事件，让监听函数执行
asyncSeriesBailHook
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
// fn1 tapable 18 2023-01-16T06:47:57.909Z
// fn1.5
// <fn1.5 返回非 undefined ，因此fn2 未执行>
// complete { result: undefined }
// time: 727.753ms

// 报错示例
// fn1 tapable 18 2023-01-16T06:49:10.549Z
// fn1.5
// --- Error ---
//  undefined
