# Overview

A play on several state management library with React, namely, [redux](https://github.com/reduxjs/redux), [mobx](https://github.com/mobxjs/mobx), [flux](https://github.com/facebook/flux).

# Usage

```bash
npm install

# development
npm run dev

```

# Comments 个人体会

Redux 是个好的状态管理方案，使用时的思路跟React本身是类似的，通过`props`注入`state`和`dispatch`，在组件中直接使用。痛苦的地方在于 Redux 的`reducers`, `action`, `middleware` 的代码比较分散，不易管理。初次使用时要认清各个`reducer`的参数和方法。

Mobx 相对与 Redux 来说，灵活性更好，以 类实例 的方式，直接读取和操作数据，且该实例可以被共享。同一个应用中可以有若干独立的 `store`。这个好处就是利于关注度提高，且有利于协同开发。

> 理论上， Redux 也可以实现多个 `store`，但是 `combineReducers` 把这些 `store` 统一到一个 `root store` 中，在应用看来，只有一个实例。

Flux 是老派的状态管理方案了，在通读了它的 `getting-started` 部分之后，我选择了保留态度。毕竟状态管理是一个方案，要跟实际使用场景结合起来，换句话说， flux 等用到了的时候我再学吧。

状态管理中值得注意的地方有三点：

- `store` 的数据如何注入组件
- 组件如何调用方法来改变`store`
- 怎么处理异步的数据改变

# 本项目没有涉及的部分，值得另外花时间完善

Mobx 中的异步的更新数据的处理方案