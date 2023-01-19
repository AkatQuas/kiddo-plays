/*
  SyncWaterfallHook
  顺序执行
  前序函数返回值传递给下一个
  如果某个函数返回 undefined，则下一个函数的入参是上一个有效的返回值，关注 fn2.5
  整体 call 结果返回值是最后一个有效结果值
*/
import { SyncWaterfallHook } from 'tapable';

// 创建实例
const syncWaterfallHook = new SyncWaterfallHook(['name', 'age']);

// 注册事件
syncWaterfallHook.tap('fn1', (name, age) => {
  console.log('fn1-->', name, age);
  return name + '_append1';
});
syncWaterfallHook.tap('fn2', (name, age) => {
  console.log('fn2-->', name, age);
  return name + '_append2';
});
syncWaterfallHook.tap('fn2.5', (name, age) => {
  console.log('fn2.5-->', name, age);
  return undefined;
});
syncWaterfallHook.tap('fn3', (name, age) => {
  console.log('fn3-->', name, age);
  return 'never_append3';
  // 假设 fn3 返回 undefined
  // call 返回的是上一个有效值，即 fn2 返回的结果 "tapable_append1_append2"
});

// 触发事件，让监听函数执行
console.log(syncWaterfallHook.call('tapable', 18));

//fn1-->tapable 18
//fn2-->1 18
//fn3-->2 18
// fn1--> tapable 18
// fn2--> tapable_append1 18
// fn2.5--> tapable_append1_append2 18
// fn3--> tapable_append1_append2 18
// never_append3
