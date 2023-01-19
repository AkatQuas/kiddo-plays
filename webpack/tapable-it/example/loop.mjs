/*
  SyncLoopHook
  循环执行
  如果某个函数返回值为 非 undefined，会从头重新开始运行，直到所有函数均返回 undefined
  整体 call 返回值是 undefined
*/
import { SyncLoopHook } from 'tapable';

// 创建实例
const syncLoopHook = new SyncLoopHook(['name', 'age']);
syncLoopHook.intercept({
  loop: (name, age) => {
    console.log('Looping with name=%s, age=%d', name, age);
  },
});

// 定义辅助变量
let num1 = 0;
let num2 = 0;

// 注册事件
syncLoopHook.tap('fn1', (name, age) => {
  console.log('fn1-->', name, age);
  return num1++ >= 3 ? undefined : 'true';
});

syncLoopHook.tap('fn2', (name, age) => {
  console.log('fn2', name, age);
  return num2++ >= 3 ? undefined : 'whatever is useless';
});
syncLoopHook.tap('fn3', (name, age) => {
  console.log('fn3', name, age);
  // return '3';
  // 此处 非 undefined ，会引起无限循环，宕机
});

// 触发事件，让监听函数执行
console.log(syncLoopHook.call('tapable', 18));

// Looping with name=tapable, age=18
// fn1--> tapable 18
// Looping with name=tapable, age=18
// fn1--> tapable 18
// Looping with name=tapable, age=18
// fn1--> tapable 18
// Looping with name=tapable, age=18
// fn1--> tapable 18
// fn2 tapable 18
// Looping with name=tapable, age=18
// fn1--> tapable 18
// fn2 tapable 18
// Looping with name=tapable, age=18
// fn1--> tapable 18
// fn2 tapable 18
// Looping with name=tapable, age=18
// fn1--> tapable 18
// fn2 tapable 18
// fn3 tapable 18
// undefined
