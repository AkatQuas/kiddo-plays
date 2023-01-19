/*
  SyncBailHook：
  顺序执行
  一旦 某个函数返回 非 undefined ，立刻中断，停止后续的执行
  整体 call 返回值为 那个非 undefined 结果
 */
import { SyncBailHook } from 'tapable';

// 创建实例
const syncBailHook = new SyncBailHook(['name', 'age']);

// 注册事件
syncBailHook.tap('fn1', (name, age) => {
  console.log('fn1-->', name, age);
  //   return 1;
});
syncBailHook.tap('fn2', (name, age) => {
  console.log('fn2-->', name, age);
  return 'fn_2'; //不是undefined
});
syncBailHook.tap('fn3', (name, age) => console.log('fn3-->', name, age));

// 触发事件，让监听函数执行
console.log(syncBailHook.call('tapable', 18));

// fn1--> tapable 18
// fn2--> tapable 18
// <fn3 不执行熔断>
// fn_2
