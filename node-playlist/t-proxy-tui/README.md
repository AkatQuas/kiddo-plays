# T-Proxy

[![license: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)

**T-Proxy** is a terminal proxy manager for local web development. Install globally, run `t-proxy`, and manage URL rewrite rules, system HTTP/HTTPS proxy, and HTTPS MITM from a TUI.

Powered by [Whistle](https://github.com/avwo/whistle) and [@earendil-works/pi-tui](https://www.npmjs.com/package/@earendil-works/pi-tui).

终端里的本地开发代理工具。`npm install -g t-proxy` 后运行 `t-proxy` 即可打开 TUI，管理 URL 转发、系统代理和 HTTPS 抓包。

## 安装

需要 Node.js **≥ 22.19.0**。

```bash
npm install -g t-proxy
```

## 快速开始

HTTPS 代理需先将根证书安装到系统信任库：

```bash
t-proxy cert generate    # 生成根证书
t-proxy cert install     # 安装到系统（macOS 需输入密码）
t-proxy                  # 启动 TUI
```

在 TUI 中：

1. **代理规则** → 添加 `from`（远程 URL）和 `to`（本地地址）
2. **系统代理** → 切换为 **开启**
3. 重启浏览器后访问目标页面

> 仅 HTTP 可跳过证书步骤；HTTPS 必须安装根证书。

## CLI 命令

| 命令                                | 说明                                |
| ----------------------------------- | ----------------------------------- |
| `t-proxy`                           | 启动 TUI                            |
| `t-proxy help`                      | 显示帮助                            |
| `t-proxy --version`                 | 显示版本                            |
| `t-proxy cert generate [--force]`   | 生成 HTTPS 根证书                   |
| `t-proxy cert install [--remote]`   | 安装根证书到系统                    |
| `t-proxy cert show`                 | 查看证书与配置路径                  |
| `t-proxy clean [--yes] [--dry-run]` | 清理配置、规则、证书与 Whistle 日志 |

## 功能

| 功能         | 说明                                                     |
| ------------ | -------------------------------------------------------- |
| 系统代理     | macOS / Windows 系统 HTTP/HTTPS 代理 → `127.0.0.1:17897` |
| 代理规则     | 远程 URL 转发到本地开发服务                              |
| HTTPS 解密   | 安装根证书后可调试 HTTPS 流量                            |
| 白名单       | 指定域名不走代理                                         |
| Whistle 面板 | 浏览器查看完整抓包记录 `http://127.0.0.1:17897`          |

## TUI 操作

### 主菜单

| 项           | 作用                                 |
| ------------ | ------------------------------------ |
| 系统代理     | 开启 / 关闭系统级代理                |
| 重启代理     | 重新应用系统代理（改白名单后需执行） |
| 代理规则     | 管理 URL 转发规则                    |
| 设置         | HTTPS 证书、白名单                   |
| Whistle 面板 | 在浏览器打开 Whistle                 |
| 退出         | 关闭系统代理并停止服务               |

### 表单弹窗（添加规则 / 白名单）

| 按键                | 作用                               |
| ------------------- | ---------------------------------- |
| `Tab` / `Shift+Tab` | 在输入框与按钮间切换焦点           |
| `Enter`             | 执行当前按钮（确认 / 取消 / 清空） |
| `Esc`               | 关闭弹窗                           |

### 全局快捷键

| 按键      | 作用                               |
| --------- | ---------------------------------- |
| `Ctrl+C`  | 退出（自动清理系统代理与 Whistle） |
| `↑` / `↓` | 列表移动                           |
| `Enter`   | 确认                               |
| `Esc`     | 返回 / 关闭弹层                    |

## 配置目录

由 [`conf`](https://github.com/sindresorhus/conf) 管理：

| 内容         | macOS 路径                                         |
| ------------ | -------------------------------------------------- |
| 主配置       | `~/Library/Preferences/t-proxy-nodejs/config.json` |
| 代理规则     | 配置内 `rules` 字段 + `whistle.rules`              |
| 根证书       | `~/Library/Preferences/t-proxy-nodejs/certs/`      |
| Whistle 数据 | `~/.WhistleAppData/.whistle/`                      |

Linux：`~/.config/t-proxy-nodejs/` · Windows：`%APPDATA%\t-proxy-nodejs\`

## 日志

- **TUI 状态栏** — 黄色提示行显示操作结果
- **Whistle 面板** — http://127.0.0.1:17897
- **日志文件** — `~/.WhistleAppData/whistle.log`

```bash
tail -f ~/.WhistleAppData/whistle.log
```

## 数据清理

重置所有本地数据（请先退出 `t-proxy`）：

```bash
t-proxy clean --dry-run   # 预览
t-proxy clean             # 交互确认
t-proxy clean --yes       # 跳过确认
```

## 常见问题

**开启代理后无法上网？**
检查白名单，或执行 **重启代理**。退出 `t-proxy` 会自动关闭系统代理。

**HTTPS 证书报错？**
执行 `t-proxy cert install` 后重启浏览器。

**规则不生效？**
确认规则已启用（●）、系统代理已开启，并在 Whistle 面板确认流量经过代理。

**端口被占用？**
`lsof -i :17897`（默认端口可在 `config.json` 修改 `port`）

## 从源码构建

```bash
git clone <repo-url> && cd t-proxy
npm install
npm run dev
npm run build
node dist/index.js
```

## License

[MIT](./LICENSE)
