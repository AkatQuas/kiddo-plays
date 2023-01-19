/*
  AsyncSeriesHook
  顺序执行
  每个函数均需要返回 promise ，或者以 async function 执行
    如果用 tap 注入函数，则按照顺序执行
  每个函数入参一致，返回值对后续函数无影响
  整体 promise 函数入参为 undefined，且执行过程中任意 reject error 可以被 catch 捕获
*/
import { AsyncSeriesHook } from 'tapable';

// 创建实例
const asyncSeriesHook = new AsyncSeriesHook(['name', 'age']);

// 注册事件
asyncSeriesHook.tapPromise('fn1', (name, age) => {
  console.log('fn1', name, age, new Date());
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      console.log('fn1 timeout', name, age, new Date());
      resolve('1');
    }, 200);
  });
});
asyncSeriesHook.tap('sync1', (name, age) => {
  console.log('sync1', name, age);
});
asyncSeriesHook.tapPromise('fn1.5', async (name, age) => {
  console.log('fn1.5', name, age, new Date());
  await new Promise((resolve, reject) => {
    setTimeout(() => (Math.random() > 0.7 ? resolve('1.5') : reject()), 100);
  });
  console.log('fn1.5 timeout', name, age, new Date());
});
asyncSeriesHook.tap('sync2', (name, age) => {
  console.log('sync2', name, age);
});
asyncSeriesHook.tapPromise('fn2', (name, age, callback) => {
  console.log('fn2', name, age, new Date());
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      console.log('fn2 timeout', name, age, new Date());
      resolve('3');
    }, 400);
  });
});

// 触发事件，让监听函数执行
console.time('time');
asyncSeriesHook
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
// fn1 tapable 18 2023-01-17T02:45:52.103Z
// fn1 timeout tapable 18 2023-01-17T02:45:52.313Z
// sync1 tapable 18
// fn1.5 tapable 18 2023-01-17T02:45:52.314Z
// fn1.5 timeout tapable 18 2023-01-17T02:45:52.419Z
// sync2 tapable 18
// fn2 tapable 18 2023-01-17T02:45:52.420Z
// fn2 timeout tapable 18 2023-01-17T02:45:52.826Z
// complete { result: undefined }
// time: 727.71ms

// 报错示例
// fn1 tapable 18 2023-01-17T02:44:54.752Z
// fn1 timeout tapable 18 2023-01-17T02:44:54.965Z
// sync1 tapable 18
// fn1.5 tapable 18 2023-01-17T02:44:54.967Z
//  --- Error ---
//  undefined
