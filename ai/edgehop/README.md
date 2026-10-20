# edgehop

局域网内多台电脑共享一套键鼠的小实验——鼠标滑出屏幕边缘（edge），控制权 hop 到旁边那台机器。类似 Synergy / Barrier，但**不同步画面**，只传键鼠和可选剪贴板。

> **这是 demo，不是日常可用的 KVM。** 联调能跑通主流程，手感与稳定性一般，别拿它当 Barrier 替代品。

## 能做什么

- 多台机器按左右顺序排成一条「逻辑桌面」
- 鼠标触左/右边缘 → focus 切到邻居，键鼠事件转发过去
- 热键（默认 ScrollLock）把控制权抢回本机
- 可选文本剪贴板同步，并做 Mac Cmd ↔ Win/Linux Ctrl 映射

## 已知局限（你会踩到）

这些大多来自原型选型，不是「再调一下参数」就能修好的：

| 现象 | 原因 |
|------|------|
| 滑到对面后，有时鼠标「失灵」、不好继续识别 | 控制端用 **pinning**（光标钉在屏心读相对位移）。`uiohook` 只观察输入、**吞不掉**本机事件；warp 与真实移动打架时，delta 会丢或抖动 |
| 控对面时，本机仍会点到/打到字 | 同上：事件仍进本机 OS |
| 边缘来回跳 | 切 focus 后有 debounce，阈值过窄或延迟叠加会感觉黏滞 |
| 跨 OS 快捷键不完全对 | 只翻「系统修饰键」Cmd/Ctrl，其余组合未细调 |

生产级方案需要 OS 级 hook（如 macOS `CGEventTap`、Windows `SetWindowsHookEx`）拦截并吞掉本地事件。本仓库没有做那一层。

## 要求

- Node.js **≥ 20**
- 同一局域网，机器之间能互访 TCP 端口（默认示例 `7788`）
- macOS：给运行用的终端/Node 开 **辅助功能** + **输入监控**，否则捕捉静默无效

## 快速开始

每台机器上：

```bash
cd edgehop
npm install
cp .env.example .env
# 编辑 .env：SELF_NAME、DEVICES（IP 与顺序）
npm start
```

### 配置要点

`DEVICES` **从左到右**写死逻辑布局，不是自动探测物理摆放：

```env
SELF_NAME=device2
DEVICES=device1@192.168.1.10:7788,device2@192.168.1.11:7788
```

- `SELF_NAME` 必须出现在 `DEVICES` 里
- 各机 `.env` 里 `DEVICES` 列表应一致；只有 `SELF_NAME` 不同
- 防火墙放行对应端口

更多项见 `.env.example`（边缘阈值、热键、剪贴板、修饰键翻译）。

## 怎么玩

1. 两台（或更多）都 `npm start`，日志里出现 peer registered
2. 焦点在本机时正常用；鼠标推到左/右边缘 → 对面开始动
3. 对面「丢了」时试 **ScrollLock**（或你设的 reclaim 热键）抢回本机

## 架构（很短）

| 模块 | 职责 |
|------|------|
| `FocusSession` | 谁握有输入权、本机是否 pinning |
| `InputPolicy` | 边缘切换、热键、钉住光标并转发 |
| `UiohookOsInput` | 读本机键鼠（可替换） |
| `Injector` | 用 robotjs 在本机注入 |
| `Network` | socket.io 网状互联 |

`npm test` 覆盖 FocusSession / InputPolicy（假 OsInput，不碰真实键鼠）。

## 许可与预期

自用 / 学习用 demo。要稳定跨机键鼠，请用 Barrier、Input Leap、Synergy 等成熟项目。
