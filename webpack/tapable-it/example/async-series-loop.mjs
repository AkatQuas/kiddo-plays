/*
  AsyncSeriesLoopHook
  循环执行
  每个函数均需要返回 promise ，或者以 async function 执行
  如果某个函数返回值为 非 undefined，会从头重新开始运行，直到所有函数均返回 undefined
  整体 call 返回值是 undefined
  整体 promise 函数入参为 undefined，且执行过程中任意 reject error 可以被 catch 捕获
*/
import { AsyncSeriesLoopHook } from 'tapable';

const asyncSeriesLoopHook = new AsyncSeriesLoopHook(['name', 'age']);

let num1 = 0;
let num2 = 0;

asyncSeriesLoopHook.tapPromise('fn1', (name, age) => {
  num1 += 1;
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      console.log('fn1-->', name, age, new Date());
      resolve(num1 > 3 ? undefined : num1);
    }, 200);
  });
});

asyncSeriesLoopHook.tapPromise('fn2', async (name, age) => {
  num2 += 1;

  console.log('fn2-->', name, age, new Date());
  return num2 > 2 ? undefined : num2;
});

asyncSeriesLoopHook.tapPromise('fn3', (name, age) => {
  return new Promise((resolve, reject) => {
    console.log('fn3-->', name, age, new Date());
    Math.random() > 0.8 ? resolve() : reject();
  });
});

console.time('time');
asyncSeriesLoopHook
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
// fn1--> tapable 18 2023-01-16T11:03:44.352Z
// fn1--> tapable 18 2023-01-16T11:03:44.570Z
// fn1--> tapable 18 2023-01-16T11:03:44.773Z
// fn1--> tapable 18 2023-01-16T11:03:44.976Z
// fn2--> tapable 18 2023-01-16T11:03:44.977Z
// fn1--> tapable 18 2023-01-16T11:03:45.178Z
// fn2--> tapable 18 2023-01-16T11:03:45.179Z
// fn1--> tapable 18 2023-01-16T11:03:45.384Z
// fn2--> tapable 18 2023-01-16T11:03:45.385Z
// fn3--> tapable 18 2023-01-16T11:03:45.386Z
// complete { result: undefined }
// time: 1.242s

// 报错示例
// fn1--> tapable 18 2023-01-16T11:03:36.501Z
// fn1--> tapable 18 2023-01-16T11:03:36.709Z
// fn1--> tapable 18 2023-01-16T11:03:36.914Z
// fn1--> tapable 18 2023-01-16T11:03:37.119Z
// fn2--> tapable 18 2023-01-16T11:03:37.120Z
// fn1--> tapable 18 2023-01-16T11:03:37.323Z
// fn2--> tapable 18 2023-01-16T11:03:37.324Z
// fn1--> tapable 18 2023-01-16T11:03:37.524Z
// fn2--> tapable 18 2023-01-16T11:03:37.524Z
// fn3--> tapable 18 2023-01-16T11:03:37.525Z
// --- Error ---
//  undefined
