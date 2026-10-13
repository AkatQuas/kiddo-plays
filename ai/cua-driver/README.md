# cua-driver

对本机安装的 [`@trycua/cua-driver`](https://www.npmjs.com/package/@trycua/cua-driver) 做能力探测：会话、截屏、应用/窗口枚举、无障碍树，以及可选的鼠标/剪贴板/点击/输入。

## 环境

- Node.js（ESM）
- macOS 13+（官方 native 包要求）
- 依赖：`@trycua/cua-driver@^0.34.1`（会按架构拉取对应 optional native 包）

```bash
npm install
```

## 运行

在本机 **GUI 终端**（「终端」/ Terminal / Ghostty 等）里执行：

```bash
npm test                 # 观察类：截屏、列应用/窗口、读光标等（不点不键）
npm run test:interact    # 额外测 moveCursor / clipboard / click / typeText
```

可选参数：

```bash
node test-capabilities.mjs --out ./out          # 指定产物目录
node test-capabilities.mjs --interact --out ./out
```

产物默认写到 `out/`：`desktop.png`、`window.png`、`apps.json`、`windows.json`、`window-state.json`、`tools.json`、`window-pick.json` 等。

## macOS 权限

对启动 `node` 的那个终端应用授予：

- **辅助功能**（Accessibility）
- **屏幕录制**（Screen Recording）

路径大致为：系统设置 → 隐私与安全性 → 辅助功能 / 屏幕录制。

改权限后若仍异常，重启终端再跑。

### SSH 下不完整是预期

本机 Terminal 通过、SSH 失败（常见 `off_space_or_ax_unresolved`、`universalAccessAuthWarn`、窗口 AX `degraded`）符合 macOS TCC 责任链行为：SSH 会话（`sshd → shell → node`）一般不继承 GUI 终端的 Accessibility / Screen Recording 授权。

交互类能力请在本机 GUI 终端验证；SSH 只适合粗看非交互结果，或以后用带完整 TCC 的 signed host。

## 已验证

| 机器 | macOS | 结果 |
|------|--------|------|
| Apple Silicon (M1) | 15.7.7 | `npm test` / `npm run test:interact` 通过 |
| Intel Mac | 13.7.8 | `npm test` / `npm run test:interact` 通过 |

## 脚本覆盖

| 类别 | 内容 |
|------|------|
| 运行时 | `CuaDriver.create`、`metadata`、`listToolsJson`、`shutdown` |
| 会话 | `startSession` / `getSession` / `endSession` |
| 观察 | `getScreenSize`、`getDesktopState`、`getCursorPosition`、`listApps`、`listWindows`、选 AX 可用窗口后的 `getWindowState` |
| 交互（`--interact`） | `moveCursor`、clipboard 读写、`bring_to_front`、`click`（Foreground）、`typeText`（desktop / 空串） |

窗口选择会优先「终端 / Ghostty / 访达」等，并跳过系统设置、辅助功能告警窗；Background 在 AX 未解析时易被拒，交互探测默认走 Foreground。

## 参考

- [Use the SDK](https://cua.ai/docs/cua-driver/guides/use-the-sdk)
- 包内说明：`node_modules/@trycua/cua-driver/README.md`
