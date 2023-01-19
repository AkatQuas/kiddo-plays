/*
  AsyncParallelHook
  异步并行执行

  理论上，每个 hook 函数需要调用 callback ，
    如果有一个不调用则最后 callAsync 的 callback 不会执行。
  每个函数之间执行互不影响。

  callback 第一个参数接收 Error ，
    且 第一个抛出的 Error 会触发 callAsync 的 callback ，后续 Error 不再触发

  即使所有回调均正常执行时， callAsync 最后的 result 也为 undefined 。
*/
import { AsyncParallelHook } from 'tapable';
// 创建实例
const asyncParallelHook = new AsyncParallelHook(['name', 'age']);

asyncParallelHook.tap('sync1', (name, age) => {
  console.log('sync1', name, age);
});

// 注册事件
asyncParallelHook.tapAsync('fn1', (name, age, callback) => {
  console.log('fn1', name, age, new Date());
  setTimeout(() => {
    console.log('fn1 timeout', name, age, new Date());
    callback('fn1 error');
  }, 100);
});

asyncParallelHook.tap('sync2', (name, age) => {
  console.log('sync2', name, age);
});

asyncParallelHook.tapAsync('fn2', (name, age, callback) => {
  console.log('fn2', name, age, new Date());
  setTimeout(() => {
    console.log('fn2 timeout', name, age, new Date());
    callback();
    // callback('fn2 error');
  }, 200);
});

console.time('time');
// 触发事件，让监听函数执行
asyncParallelHook.callAsync('tapable', 18, (e, result) => {
  if (e) {
    console.debug('\x1B[97;101;1m --- error --- \x1B[m', '\n', e);
  } else {
    console.log('complete', { result });
  }
  console.timeEnd('time');
});

// 成功示例
// sync1 tapable 18
// fn1 tapable 18 2023-01-17T02:42:23.027Z
// sync2 tapable 18
// fn2 tapable 18 2023-01-17T02:42:23.028Z
// fn1 timeout tapable 18 2023-01-17T02:42:23.132Z
// fn2 timeout tapable 18 2023-01-17T02:42:23.230Z
// complete { result: undefined }
// time: 214.574ms

// 报错示例
// sync1 tapable 18
// fn1 tapable 18 2023-01-17T02:43:23.041Z
// sync2 tapable 18
// fn2 tapable 18 2023-01-17T02:43:23.042Z
// fn1 timeout tapable 18 2023-01-17T02:43:23.147Z
//  --- error ---
//  fn1 error
// time: 115.126ms
// fn2 timeout tapable 18 2023-01-17T02:43:23.246Z
//                 ^ 这行是因为 setTimeout 必然会执行，只不过其 Error 结果没有意义了
