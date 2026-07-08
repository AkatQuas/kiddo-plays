# Web CLI — 基于 TanStack Start 的 Web 在线终端 MVP

> **轻量化 Web 交互式终端 MVP** — 基于 TanStack Start 全栈框架，通过 xterm.js、Socket.io、node-pty 打通「前端渲染 → 全栈状态管控 → 长连接实时通信 → 系统进程调度」完整链路。
> [Design](./DESIGN.md) 架构详细设计文档

---

## 目录

- [快速启动](#快速启动)
- [项目定位](#项目定位)
- [核心技术栈](#核心技术栈)
- [四层全栈架构](#四层全栈架构)
- [架构原理图](#架构原理图)
- [消息链路图](#消息链路图)
- [完整数据流转链路](#完整数据流转链路)
- [关键架构说明（适配 TanStack Start）](#关键架构说明适配-tanstack-start)
- [架构核心约束](#架构核心约束)
- [项目结构](#项目结构)
- [开发指南](#开发指南)
- [注意事项](#注意事项)

---

## 快速启动

```bash
# 安装依赖（含 node-pty 原生编译）
pnpm install
npx node-gyp rebuild --directory=node_modules/.pnpm/node-pty@1.1.0/node_modules/node-pty

# 开发模式启动
pnpm dev

# 构建生产版本
pnpm build

# 预览生产版本
pnpm preview

# 启动生产内容
pnpm start
```

打开浏览器访问 `http://localhost:3000`，点击导航栏 **Terminal** 进入在线终端。

---

## 项目定位

本项目为 **轻量化 Web 交互式终端 MVP**，基于 TanStack Start 全栈框架搭建，依托 xterm.js、Socket.io、node-pty、系统 PTY 能力，实现浏览器端全真系统命令执行终端。

**核心价值：** 摒弃传统前后端割裂开发模式，以 TanStack 全栈一体化能力统一状态、数据流、会话管理，同时保留原生终端底层执行链路，保证命令执行与本地终端完全一致，兼顾开发规范性与终端交互真实性。

---

## 核心技术栈

| 层级           | 技术                | 作用                                                        |
| -------------- | ------------------- | ----------------------------------------------------------- |
| **全栈框架**   | TanStack Start      | 全栈一体化框架，Vite 构建 + srvx 托管服务、统一路由         |
| **状态管理**   | TanStack Store      | 全局统一管控连接状态、会话状态、终端尺寸（useSelector API） |
| **路由管理**   | TanStack Router     | 终端页面路由托管、会话与路由绑定                            |
| **终端模拟**   | xterm.js            | 浏览器端终端渲染、键盘交互、终端尺寸适配                    |
| **长连接**     | Socket.io           | 双向字符流实时传输、断线重连、心跳保活、HTTP 长轮询降级     |
| **PTY 管理**   | node-pty            | 服务端伪终端创建、Shell 进程绑定、数据流读写                |
| **系统 Shell** | bash/zsh/powershell | 操作系统原生命令解析执行                                    |
| **样式框架**   | Tailwind CSS        | 界面样式系统                                                |

---

## 四层全栈架构

完全适配 TanStack Start 运行机制，分层清晰、权责分离：

```
┌─────────────────────────────────────────────────────────┐
│  ① 前端渲染与全栈状态层                                  │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐                │
│  │ xterm.js │ │ TanStack │ │ TanStack │                │
│  │ 终端渲染  │ │  Store   │ │  Router  │                │
│  └──────────┘ └──────────┘ └──────────┘                │
├─────────────────────────────────────────────────────────┤
│  ② TanStack Start 全栈托管层                            │
│  ┌──────────────┐ ┌────────────┐ ┌──────────────┐      │
│  │ Vite 构建系统 │ │ srvx 托管  │ │ 全栈数据协议  │      │
│  └──────────────┘ └────────────┘ └──────────────┘      │
├─────────────────────────────────────────────────────────┤
│  ③ 长连接实时通信层 (Socket.io)                          │
│  ┌────────────────┐ ┌──────────┐ ┌──────────────────┐  │
│  │ WebSocket 主链路│ │ HTTP长轮 │ │ 断线重连 / 心跳    │  │
│  │                │ │ 询降级   │ │ 保活             │  │
│  └────────────────┘ └──────────┘ └──────────────────┘  │
├─────────────────────────────────────────────────────────┤
│  ④ 系统底层进程调度层                                     │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐   │
│  │ node-pty │ │ PTY设备对│ │ Shell进程│ │ 原生命令  │   │
│  │          │ │ m/s fd   │ │          │ │ 程序     │   │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘   │
└─────────────────────────────────────────────────────────┘
```

### 各层权责

#### ① 前端渲染与全栈状态层

- **xterm.js**: 终端界面渲染、键盘输入/退格/回车/Tab补全、Ctrl+L清屏、窗口自适应
- **Socket.io Client**: 长连接初始化、自动重连、链路降级
- **TanStack Store**: 全局网络/会话/命令执行状态管控
- **TanStack Router**: 终端独立路由绑定

#### ② TanStack Start 全栈托管层

- Vite 构建 + srvx 托管全局服务
- 统一规范前后端数据交互协议
- 管理会话生命周期
- 提供全局异常兜底

#### ③ 长连接实时通信层

- 双向字符流实时传输
- 终端尺寸同步
- 断线重连、会话保活
- WebSocket 主链路 + HTTP 长轮询降级兜底

#### ④ 系统底层进程调度层

- 伪终端创建销毁
- Shell 进程托管
- 系统命令解析执行
- 进程资源自动回收

---

## 架构原理图

```
┌─────────────────── 浏览器 ───────────────────┐
│                                              │
│  ┌──────────┐   ┌──────────────────────┐     │
│  │ xterm.js │◄──│ Socket.io Client     │     │
│  │ 终端渲染  │   │ 双向字符流处理       │     │
│  └────┬─────┘   └──────────┬───────────┘     │
│       │                    │                  │
│  ┌────▼────────────────────▼───────────┐     │
│  │      TanStack 全栈状态层             │     │
│  │  ┌────────┐ ┌─────────┐            │     │
│  │  │ Store  │ │ Router  │            │     │
│  │  └────────┘ └─────────┘            │     │
│  └─────────────────────────────────────┘     │
└──────────────────────┬───────────────────────┘
                       │ WebSocket / HTTP
                       ▼
┌────────────── TanStack Start (srvx) ────────────┐
│                                                    │
│  ┌──────────────────────────────────────────────┐  │
│  │  Socket.io Server (挂载在 srvx HTTP Server)   │  │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────────┐ │  │
│  │  │ WebSocket│ │ 长轮询   │ │ 心跳 / 重连   │ │  │
│  │  └──────────┘ └──────────┘ └──────────────┘ │  │
│  └────────────────────┬─────────────────────────┘  │
│                       │                            │
│  ┌────────────────────▼─────────────────────────┐  │
│  │  node-pty / 系统 PTY 层                       │  │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────────┐  │  │
│  │  │ PTY      │ │ Shell    │ │ 数据流读写    │  │  │
│  │  │ master fd│ │ process  │ │ onData/write │  │  │
│  │  └──────────┘ └──────────┘ └──────────────┘  │  │
│  └────────────────────┬─────────────────────────┘  │
│                       │                            │
└───────────────────────┼────────────────────────────┘
                        │
               ┌────────▼────────┐
               │  操作系统内核    │
               │  (系统调用执行)   │
               └─────────────────┘
```

### Socket.io 挂载方式

```
┌─────────────────────────────────────────────┐
│  Vite Dev/Preview Server (srvx Node HTTP)   │
│  ┌───────────────────────────────────────┐  │
│  │   TanStack Start Request Handler      │  │
│  │   (router + SSR + server functions)   │  │
│  └───────────────────────────────────────┘  │
│                                              │
│  ┌───────────────────────────────────────┐  │
│  │   Socket.io Server                    │  │
│  │   (挂载在同一 HTTP Server 实例上)      │  │
│  └───────────────────────────────────────┘  │
│                                              │
│  Vite Plugin configureServer 触发             │
│  → bootstrap.mjs (原生 Node.js import)       │
│  → new SocketServer(httpServer)              │
│  → 复用同一个端口，不创建新服务               │
└─────────────────────────────────────────────┘
```

---

## 消息链路图

### 用户执行一条系统命令的完整数据流

```
用户按键
   │
   ▼
xterm.js 捕获 onData 事件
   │
   ▼
客户端本地缓冲 Shift+Enter 换行符
普通字符/Enter 直接编码发送
   │  emit('terminal:input', { sessionId, data })
   ▼
WebSocket 传输 (或 HTTP 长轮询降级)
   │
   ▼
Socket.io Server (srvx HTTP Server 实例)
   │
   ▼
bootstrap.mjs: session.pty.write(data)
   │
   ▼
PTY master fd
   │
   ▼
PTY slave fd → Shell 进程 (bash/zsh)
   │
   ▼
操作系统执行命令 (fork/exec)
   │
   ▼
命令输出 → PTY slave fd → PTY master fd
   │
   ▼
bootstrap.mjs: pty.onData(output)
   │
   ▼
Socket.io emit('terminal:output', { sessionId, data })
   │
   ▼
WebSocket 传输
   │
   ▼
客户端接收 terminal:output 事件
   │
   ▼
TanStack Store 更新连接/会话状态
   │
   ▼
xterm.js: term.write(data)
   │
   ▼
用户看到命令输出
```

### 会话生命周期

```
页面加载
   │
   ▼
Socket.io Client 连接 (自动重连机制)
   │
   ▼
emit('terminal:connect', { cols, rows })
   │
   ▼
服务端创建 PTY session
   ├─ node-pty.spawn(shell, [], { cols, rows })
   ├─ pty.onData → socket emit('terminal:output')
   └─ pty.onExit → socket emit('terminal:exit')
   │
   ▼
emit('terminal:connected', { sessionId, pid })
   │
   ▼
[交互阶段]
   ├─ 用户输入 → pty.write(data)
   ├─ Shift+Enter → 本地缓冲 \n
   ├─ bare Enter → 发送缓冲 + \r
   ├─ PTY输出 → term.write(data)
   ├─ 窗口resize → pty.resize(cols, rows)
   └─ Ctrl+C/Ctrl+D → 正常进程交互
   │
   ▼
页面关闭 / 导航离开
   │
   ▼
Socket.io disconnect 事件
   │
   ▼
bootstrap.mjs 遍历 socket 对应 sessions
   ├─ session.pty.kill()
   ├─ Shell 进程终止
   └─ 资源完全释放
```

---

## 关键架构说明（适配 TanStack Start）

### TanStack Start 框架约束

TanStack Start 基于 **Vite 多环境架构**，底层使用 **srvx** 作为 Node.js HTTP Server。框架独占全局 HTTP Server 实例，**禁止开发者手动创建、劫持、新建 HTTP 服务**。传统 Socket.io 独立挂载端口、手动绑定服务的写法完全失效。

### 适配方案

本项目的关键创新在于使用 **Vite 插件 `configureServer` / `configurePreviewServer` 钩子**，在 TanStack Start 内置服务器启动后，**复用框架原生 HTTP Server 实例全局单例挂载 Socket.io**。

引导模块 `src/server/bootstrap.mjs` 以**原生 Node.js ESM** 运行，通过 `createRequire` 加载 node-pty，完全绕过 Vite 模块处理器（Vite 无法解析 node-pty 的原生 `.node` 扩展）：

```typescript
// src/server/socket-vite-plugin.ts
configureServer(server) {
  const httpServer = server.httpServer
  import(new URL('bootstrap.mjs', import.meta.url).href).then(mod => {
    mod.attachToHttpServer(httpServer)
  })
}
```

核心优势：

- ✅ 不新建服务、不占用新端口
- ✅ 不破坏框架原有路由与服务函数体系
- ✅ 支持 dev 与 preview 两种模式
- ✅ 生命周期自动管理

---

## 架构核心约束

### 🚫 禁止项（规避致命冲突）

1. **禁止**手动创建原生 HTTP Server（`http.createServer`）
2. **禁止**独立启动 Socket.io 占用新端口
3. **禁止**在 TanStack 服务函数（`createServerFn`）内初始化 Socket 实例 — 生命周期错乱
4. **禁止**混用多套服务实例 — 严格保证 Socket.io 全局单例运行

### ✅ 强制规范

1. Socket.io 必须通过 Vite 插件 `configureServer`/`configurePreviewServer` 钩子初始化，复用框架原生 HTTP Server 实例
2. 会话、Socket 连接、PTY 进程三者必须一一绑定，生命周期同步
3. TanStack 状态层仅负责状态同步与数据订阅，不干预底层长连接与进程调度逻辑
4. 所有数据流遵循统一全栈协议，保证前后端数据一致性
5. 服务端 PTY 引导模块（`bootstrap.mjs`）必须使用原生 Node.js `import()` 加载，避免 Vite 模块处理器无法解析 node-pty 原生扩展

---

## 项目结构

```
web-cli/
├── src/
│   ├── components/
│   │   ├── Terminal.tsx          # 主终端组件 (xterm.js + Socket.io Client)
│   │   ├── Header.tsx            # 导航栏 (含 Terminal 链接)
│   │   ├── Footer.tsx            # 页脚
│   │   └── ThemeToggle.tsx       # 主题切换
│   │
│   ├── lib/
│   │   ├── terminal-store.ts     # TanStack Store 终端状态管理
│   │   └── terminal-types.ts     # (保留) Socket.io 事件协议类型
│   │
│   ├── server/
│   │   ├── bootstrap.mjs          # Socket.io + node-pty 引导模块 (原生 Node.js ESM)
│   │   └── socket-vite-plugin.ts  # Vite 插件 — 将 Socket.io 挂载到 HTTP Server
│   │
│   ├── routes/
│   │   ├── __root.tsx            # 根布局 (含终端全屏判断)
│   │   ├── index.tsx             # 首页
│   │   ├── about.tsx             # 关于页
│   │   └── terminal.tsx          # 终端页面路由
│   │
│   ├── router.tsx                # TanStack Router 配置
│   ├── routeTree.gen.ts          # 路由树 (自动生成)
│   └── styles.css                # 全局样式 (含终端暗色主题)
│
├── vite.config.ts                # Vite 配置 (含 socket-server 插件)
├── package.json
├── tsconfig.json
├── DESIGN.md                     # 详细架构设计文档
└── README.md                     # 本文档
```

---

## 开发指南

### 扩展终端能力

如需添加新的终端事件或功能：

1. **服务端实现**：在 `src/server/bootstrap.mjs` 中，socket `on()` 监听新事件，调用 `ptyProcess.write()` 或 `ptyProcess.resize()` 等
2. **客户端实现**：在 `src/components/Terminal.tsx` 中添加 socket 事件监听（`socket.on(...)`）和 xterm.js 渲染处理（`term.write(data)`）
3. **状态同步**：在 `src/lib/terminal-store.ts` 中添加对应的 Store state 字段和 action

### 示例：添加自定义终端通知

```typescript
// 1. 服务端 — bootstrap.mjs
socket.emit('terminal:notification', {
  message: 'Command completed',
  level: 'info',
});

// 2. 客户端 — Terminal.tsx
socket.on('terminal:notification', ({ message, level }) => {
  term.writeln(`\r\n[${level.toUpperCase()}] ${message}`);
});
```

### 添加 Shell 配置

在 `src/server/bootstrap.mjs` 的 `getDefaultShell()` 函数中配置默认 Shell：

```javascript
function getDefaultShell() {
  if (process.platform === 'win32') return 'powershell.exe';
  return process.env.SHELL || '/bin/bash';
}
```

---

## 注意事项

### node-pty 构建

node-pty 包含原生 C++ 扩展，安装后需要编译：

```bash
# macOS: Xcode Command Line Tools
xcode-select --install

# pnpm 安装并批准构建
pnpm install
pnpm approve-builds node-pty

# 手动编译原生扩展 (spawn-helper 二进制文件)
npx node-gyp rebuild --directory=node_modules/.pnpm/node-pty@1.1.0/node_modules/node-pty
```

### 安全考虑

当前 MVP 直接使用系统 Shell 执行命令，**没有做命令白名单或沙箱隔离**。如需用于生产环境，建议：

1. 添加用户认证与会话鉴权
2. 限制可执行命令范围
3. 使用容器化隔离 (Docker)
4. 添加上下文超时与资源限制

### 浏览器兼容性

- xterm.js 支持所有现代浏览器 (Chrome, Firefox, Safari, Edge)
- Socket.io WebSocket 需要 HTTPS (生产环境)
- HTTP 长轮询作为降级方案在所有浏览器可用

---

## License

MIT
