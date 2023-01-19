/*
  SyncHook
  顺序执行
  每个函数返回值均不关心
  整体 call 返回值为 undefined
*/
import { SyncHook } from 'tapable';

// 创建实例
const syncHook = new SyncHook(['name', 'age']);
syncHook.intercept({
  register: (tapInfo) => {
    console.log(`${tapInfo.name} is registering`);
  },
  call: (name, age) => {
    console.log('Call it now! name=%s, age=%d', name, age);
  },
});

// 注册事件
syncHook.tap('fn1', (name, age) => {
  console.log('fn1-->', name, age);
  return 'fn-1';
});
syncHook.tap('fn2', (name, age) => {
  console.log('fn2-->', name, age);
  return 'fn-2';
});
syncHook.tap('fn3', (name, age) => {
  console.log('fn3-->', name, age);
  return 'fn-3';
});

// 触发事件，让监听函数执行
console.log(syncHook.call('tapable', 18));

// fn1 is registering
// fn2 is registering
// fn3 is registering
// Call it now! name=tapable, age=18
// fn1--> tapable 18
// fn2--> tapable 18
// fn3--> tapable 18
// undefined
