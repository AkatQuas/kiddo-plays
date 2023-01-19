/*
  AsyncParallelBailHook
  异步并行执行

  理论上，每个 hook 函数需要调用 callback ，
    如果有一个不调用则最后 callAsync 的 callback 不会执行。
  每个函数之间执行互不影响。

  callback 第一个参数接收 Error ，
    且 第一个抛出的 Error 会触发 callAsync 的 callback ，后续 Error 不再触发

  即使所有回调均正常执行时， callAsync 最后的 result 也为 undefined 。
*/
import { AsyncParallelBailHook } from 'tapable';

// 创建实例
const asyncParallelBailHook = new AsyncParallelBailHook(['name', 'age']);

// 注册事件
asyncParallelBailHook.tapAsync('fn1', (name, age, callback) => {
  setTimeout(() => {
    console.log('fn1', name, age, new Date());
    // callback('e1');
    callback();
  }, 100);
});

asyncParallelBailHook.tapAsync('fn2', (name, age, callback) => {
  setTimeout(() => {
    console.log('fn2', name, age, new Date());
    // callback('error');
    callback();
  }, 200);
});

console.time('time');
// 触发事件，让监听函数执行
asyncParallelBailHook.callAsync('tapable', 18, (e, result) => {
  if (e) {
    console.debug('\x1B[97;101;1m --- error --- \x1B[m', '\n', e);
  } else {
    console.log('complete', { result });
  }
  console.timeEnd('time');
});

// 成功示例
// fn1 tapable 18 2023-01-16T11:35:16.660Z
// fn2 tapable 18 2023-01-16T11:35:16.760Z
// complete { result: undefined }
// time: 209.478ms

// 报错示例
// fn1 tapable 18 2023-01-16T11:33:39.878Z
//  --- error ---
//  e1
// time: 123.492ms
// fn2 tapable 18 2023-01-16T11:33:39.979Z
