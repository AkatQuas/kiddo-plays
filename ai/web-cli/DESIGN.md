# 基于 TanStack Start 全栈框架的 Web 在线终端 MVP — 架构最终方案

## 一、项目核心定位

本项目为**轻量化 Web 交互式终端 MVP**，基于 TanStack Start 全栈框架搭建，依托 xterm.js、Socket.io、node-pty、系统 PTY 能力，实现浏览器端全真系统命令执行终端。核心目标为打通「前端渲染-全栈状态管控-长连接实时通信-系统进程调度」完整链路，基于 TanStack Start Vite 插件机制做适配改造，规避框架原生服务冲突，产出可直接落地、无架构缺陷的最小可用 Web 终端产品。

MVP 核心价值：摒弃传统前后端割裂开发模式，以 TanStack 全栈一体化能力统一状态、数据流、会话管理，同时保留原生终端底层执行链路，保证命令执行与本地终端完全一致，兼顾开发规范性与终端交互真实性。

## 二、核心技术栈明细（最终定型）

所有技术选型适配 TanStack Start 架构特性，无冗余、无冲突、可稳定落地：

### 2.1 全栈核心框架

- **TanStack Start**：全栈一体化开发框架，提供 Vite 构建、H3/srvx 托管服务、服务端函数、统一路由、全栈数据协同能力

- **TanStack Store**：全局统一管控连接状态、会话状态、终端尺寸、进程运行状态（使用 `useSelector` API）

- **TanStack Router**：终端页面路由托管、会话与路由绑定、页面刷新状态恢复

### 2.2 终端核心能力栈

- **xterm.js**：浏览器端终端模拟器，负责界面渲染、键盘交互、终端尺寸适配

- **Socket.io**：双向长连接通信，承载终端字符流实时传输，提供断线重连、心跳保活、HTTP 长轮询降级能力

- **node-pty**：服务端 PTY 进程管理，创建系统伪终端、绑定 Shell 进程、读写终端数据流

- **系统 PTY/Shell**：操作系统原生终端设备与命令解析进程，保证原生命令执行能力

## 三、关键架构前置说明（解决 TanStack Start 适配痛点）

### 3.1 框架核心特性与约束

TanStack Start 基于 **Vite 多环境架构**，底层使用 **srvx** 作为 Node.js HTTP Server。框架独占全局 HTTP Server 实例，**禁止开发者手动创建、劫持、新建 HTTP 服务**。传统 Socket.io 独立挂载端口、手动绑定服务的写法完全失效，会直接引发端口冲突、握手失败、服务启动异常。

同时 TanStack Start 原生设计偏向**短链接 RPC 服务函数**，无原生成熟长连接方案，因此必须采用 Vite 插件生命周期钩子适配 Socket.io，实现长连接与框架原生服务共存。

### 3.2 最终唯一适配方案（MVP 标准）

基于 Vite 插件 **configureServer / configurePreviewServer** 钩子，在 TanStack Start 内置服务器启动完成后，**复用框架原生 HTTP Server 实例全局单例挂载 Socket.io**。不使用 `onAfterListen` 或 H3 专属钩子，只依赖 Vite 标准插件 API，兼容 dev 与 preview 两种运行模式。

核心代码在 `src/server/bootstrap.mjs`（以原生 Node.js ESM 运行，完全绕过 Vite 模块处理，确保 `node-pty` 原生扩展可正确加载）。

## 四、最终定型四层全栈架构（正式落地版）

完全适配 TanStack Start 运行机制，分层清晰、权责分离，彻底解决前后端割裂、服务冲突、状态不同步问题：

1. **前端渲染与全栈状态层**
   - 核心组件：浏览器、xterm.js 终端模拟器、TanStack Store/Router、Socket.io Client
   - 核心权责：终端界面渲染、用户键盘交互监听、全局状态管控、流式数据订阅渲染、路由会话绑定、网络状态感知

2. **TanStack Start 全栈托管层**
   - 核心组件：Vite 构建系统、srvx 托管服务、服务端函数、全栈数据协议规范
   - 核心权责：全局服务托管、会话 ID 统一生成与绑定、全栈数据格式标准化、异常统一兜底、短链接业务支撑

3. **长连接实时通信层**
   - 核心组件：srvx Node HTTP Server、全局单例 Socket.io 服务、WebSocket 主链路、HTTP 长轮询降级兜底
   - 核心权责：双向字符流实时传输、终端尺寸同步、断线重连、会话保活、连接状态同步、异常容错

4. **系统底层进程调度层**
   - 核心组件：node-pty、系统 PTY 设备对（master/slave）、系统 Shell 进程、原生命令程序
   - 核心权责：伪终端创建销毁、Shell 进程托管、系统命令解析执行、底层数据流读写、进程资源回收

## 五、分层详细设计与权责边界

### 5.1 前端层设计

基于 TanStack 生态标准化所有前端逻辑，杜绝零散原生代码，保证状态与数据流可控：

- **xterm.js 终端能力**：基础界面渲染、键盘输入/退格/回车/Tab 补全、Ctrl+L 清屏、窗口自适应；终端尺寸、渲染状态绑定 TanStack Store 全局状态
- **本地输入缓冲**：Shift+Enter / Ctrl+J 插入换行，仅 bare Enter 发送完整行到 PTY；每个字符转发到 PTY 以获得正确的 shell 回显
- **Socket.io 客户端**：长连接初始化、自动重连、链路降级；所有连接状态同步至全局状态
- **TanStack Store**：Router 绑定终端独立路由与会话信息；Store 统一管理网络、会话、命令执行状态

### 5.2 TanStack Start 服务托管层设计

作为全栈架构中枢，衔接前端状态与底层长连接、进程能力：

- 统一规范前后端数据交互协议，所有输入输出数据标准化封装
- 管理会话生命周期，实现前端路由会话、Socket 连接、PTY 进程三者一一绑定
- 提供全局异常兜底、状态同步、基础服务托管能力，不干预 Socket 长连接与 PTY 底层逻辑

### 5.3 Socket.io 长连接层设计

终端核心通信载体，完全适配 Vite 插件生命周期：

- 全局单例初始化，基于 Vite 插件 `configureServer` / `configurePreviewServer` 钩子，仅在服务器启动后执行一次，无重复实例、无端口冲突
- 引导模块 `bootstrap.mjs` 使用原生 Node.js 动态 `import()` 加载（`createRequire` 加载 node-pty），完全绕过 Vite 模块解析
- 监听客户端连接/断开事件，绑定对应 PTY 进程，实现连接与进程一一映射
- 实时转发前端输入字符流与服务端命令输出流，支持终端 resize 同步、异常断线重连
- 自动降级机制：WebSocket 异常时无缝切换 HTTP 长轮询，保障弱网可用性

### 5.4 系统底层调度层设计

完全保留原生终端执行链路，无自定义改造，保证原生兼容性：

- node-pty 根据系统自适应拉起 bash/zsh/powershell/cmd 等默认 Shell
- 创建系统标准 PTY master/slave 设备对，通过 master fd 实现数据读写
- slave fd 绑定 Shell 进程，接管标准输入、输出、错误流，执行系统原生命令
- 自动资源回收：连接断开、页面关闭、会话过期时，自动销毁 PTY 与 Shell 进程，杜绝资源泄露

## 六、全栈完整数据流转链路（标准化闭环）

以用户执行任意系统命令为例，完整适配 TanStack Start 架构的流转流程：

1. 用户在 xterm.js 终端输入命令，前端捕获交互事件

2. 客户端将每个字符通过 WebSocket 长连接推送至服务端 Socket.io 实例，同时缓冲 Shift+Enter 产生的换行符

3. 服务端校验会话合法性，通过 `pty.write(data)` 转发字符至对应会话的 node-pty 实例

4. node-pty 通过 PTY master fd 将输入数据写入系统 slave 终端设备，由绑定的 Shell 进程解析命令

5. 操作系统内核执行对应命令程序，执行结果、日志、错误信息通过 PTY 设备对回传至 node-pty

6. Socket.io 服务端实时接收 PTY 输出数据流，通过 `terminal:output` 事件推送至前端客户端

7. 前端 xterm.js 通过 `term.write(data)` 直接渲染终端输出流

8. TanStack Store 同步更新连接状态、会话状态，完成一次完整交互闭环

## 七、架构核心约束与 MVP 开发规范

### 7.1 架构禁止项（规避致命冲突）

- 禁止手动创建原生 HTTP Server、禁止独立启动 Socket.io 占用端口
- 禁止在 TanStack 服务函数内初始化 Socket 实例（生命周期错乱）
- 禁止混用多套服务实例，严格保证 Socket.io 全局单例运行

### 7.2 架构强制规范

- Socket.io 必须通过 Vite 插件 `configureServer` / `configurePreviewServer` 钩子初始化，复用框架原生 HTTP Server 实例
- 会话、Socket 连接、PTY 进程三者必须一一绑定，生命周期同步
- TanStack 状态层仅负责状态同步与数据订阅，不干预底层长连接与进程调度逻辑
- 所有数据流遵循统一全栈协议，保证前后端数据一致性
- 服务端 PTY 引导模块（`bootstrap.mjs`）必须使用原生 Node.js `import()` 加载，避免 Vite 模块处理器无法解析 node-pty 原生扩展