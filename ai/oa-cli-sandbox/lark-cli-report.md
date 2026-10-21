# @larksuite/cli (lark-cli) 逆向方案调研

> 调研日期：2027-02-13
> 包版本：1.0.89
> 源码仓库：<https://github.com/larksuite/cli>

---

## 1. 包概述

`@larksuite/cli` 是**飞书 / Lark 官方命令行工具**，使用 **Go** 编写，通过 npm 分发 + 下载平台相关二进制。

| 项目 | 内容 |
|------|------|
| 包名 | `@larksuite/cli` |
| 版本 | 1.0.89 |
| 许可证 | MIT |
| 仓库 | <https://github.com/larksuite/cli> |
| 描述 | 飞书命令行工具，覆盖消息、审批、多维表格、日历、通讯录、文档、云盘、即时通讯、邮箱、Markdown、思维笔记、妙记、OKR、电子表格、幻灯片、任务、视频会议、白板、知识库等全域业务 |
| 编程语言 | Go (主二进制 ~46MB), JavaScript (启动 loader / 安装向导) |
| 平台支持 | macOS (x64/arm64), Linux (x64/arm64/riscv64), Windows (x64) |
| Node.js 要求 | >= 16 |

### 架构示意

```
npm install -g @larksuite/cli
         ↓
  bin/lark-cli (symlink) → scripts/run.js      ← Node.js 薄壳，检测平台
         ↓
  scripts/install.js     ← 下载 lark-cli-<version>-<platform>-<arch>.tar.gz
         ↓
  bin/lark-cli           ← Go 原生二进制 (~46MB Mach-O x86_64)
```

`scripts/run.js` 负责：拦截 `install` 子命令走向导，自动下载缺失二进制，校验 SHA-256 checksum，然后 `execFileSync` 调用原生二进制。

安装向导 `scripts/install-wizard.js` 提供 4 步交互式安装：全局安装 → 安装 Skills → 配置应用 → 授权。

---

## 2. 现有 Sidecar 沙箱架构（关键发现）

**本仓库源码已经实现了完整的 sidecar/auth-proxy 分离架构**，这正是用户"拆成两步走"方案所需的核心基础设施。

### 2.1 构建模式

通过 Go build tag 控制两种构建：

| Build Tag | 文件名 | 行为 |
|-----------|--------|------|
| `!authsidecar` (默认) | `main.go` + `main_noauthsidecar.go` | 完整凭证能力，env/本地 keychain 凭证源 |
| `authsidecar` | `main_authsidecar.go` | 沙箱模式，激活 sidecar 凭证提供者和传输拦截器 |

侧记 build 命令：
```bash
go build -tags authsidecar -o lark-cli-sandbox .
```

### 2.2 沙箱侧（authsidecar 构建）

环境变量激活（所有凭证都是 placeholder）：

```bash
export LARKSUITE_CLI_AUTH_PROXY=http://127.0.0.1:16384
export LARKSUITE_CLI_PROXY_KEY=<hmac-key>
export LARKSUITE_CLI_APP_ID=cli_a93270046db95bde
export LARKSUITE_CLI_BRAND=feishu
# 不需要 APP_SECRET 或其他真实凭证
```

沙箱中运行的 CLI：
- 凭证提供者 (`extension/credential/sidecar/provider.go`) 返回 placeholder token：`sidecar-managed-uat` / `sidecar-managed-tat`
- 传输拦截器 (`extension/transport/sidecar/interceptor.go`) 拦截所有 HTTP 请求：
  1. 检测到 placeholder token 时触发
  2. 缓存请求 body 用于 HMAC 签名
  3. 注入代理 header：`X-Lark-Proxy-Version`, `X-Lark-Proxy-Identity`, `X-Lark-Proxy-Signature`, `X-Lark-Proxy-Timestamp`, `X-Lark-Body-SHA256`, `X-Lark-Proxy-Auth-Header`
  4. 用 HMAC-SHA256 签名 canonical request
  5. 将 URL 重写为 `http://<sidecar-host>`（如 `http://127.0.0.1:16384`）
- 无 placeholder token 的请求（如预签名下载 URL）透传不变

### 2.3 凭证托管侧（auth 服务 / sidecar 守护进程）

源码提供了两个 demo sidecar 服务：
- `sidecar/server-demo/` — 单租户 sidecar 示例
- `sidecar/server-multi-tenant-demo/` — 多租户 sidecar 示例

Sidecar 服务端逻辑：
1. 接收经过沙箱重写的 HTTP 请求
2. 验证 HMAC 签名 + 时间戳防重放（60s 窗口）
3. 验证目标 host 在白名单中
4. 用真实凭证提供者解析 UAT/TAT
5. 将真实 token 注入到请求头
6. 转发请求到飞书 API 真实端点
7. 返回结果给沙箱

### 2.4 HMAC 签名协议

```go
type CanonicalRequest struct {
    Version      string // "v1"
    Method       string // "GET", "POST"
    Host         string // "open.feishu.cn"
    PathAndQuery string // "/open-apis/calendar/v4/events?page_size=50"
    BodySHA256   string // hex(SHA-256(body))
    Timestamp    string // Unix epoch seconds
    Identity     string // "user" 或 "bot"
    AuthHeader   string // "Authorization" 或 "X-Lark-MCP-UAT" 等
}

// HMAC-SHA256(canonicalString)
```

安全约束：
- ✅ 同一机器限制（host 必须是 loopback 或已知容器别名）
- ✅ userinfo 拒绝（防 URL 钓鱼）
- ✅ https 拒绝（同一机器上 TLS 无额外安全）
- ✅ 每个请求字段都参与签名（防篡改）
- ✅ 60s 时间戳防重放窗口

---

## 3. 认证机制

### 3.1 应用注册

```bash
lark-cli config init --new --lang zh_cn
```

设备流程（OAuth Device Flow）：
1. POST `/oauth/v1/app/registration` (action=begin) → 获取 device_code + user_code + 二维码
2. 用户在浏览器扫码或打开 URL 确认注册
3. 轮询 `/oauth/v1/app/registration` (action=poll) → 获取 client_id + client_secret
4. 返回 `appId` / `appSecret` / `brand`

### 3.2 用户授权

```bash
lark-cli auth login [--domain im,docs,...] [--scope "..."] [--no-wait] [--json]
```

设备流程（标准 OAuth 2.0 Device Authorization Grant）：
1. POST `/open-apis/authen/v2/device_authorization` → device_code + user_code + verification_url
2. 用户扫码或在浏览器中完成授权
3. POST `/open-apis/authen/v2/oauth/token` (grant_type=device_token) → access_token + refresh_token
4. GET `/open-apis/authen/v1/user_info` → 获取用户 open_id + name

### 3.3 无等待模式（AI Agent 友好）

```bash
# Step 1: 发起授权，返回 JSON（包含 verification_url + device_code）
lark-cli auth login --no-wait --json

# Step 2: 用户扫码后，用 device_code 轮询完成授权
lark-cli auth login --device-code <device_code>
```

这个模式天然适合 AI Agent 分两步完成授权。

### 3.4 当前机器凭证状态

从 `~/.lark-cli/config.json` + `~/Library/Application Support/lark-cli/` 解密得到：

```json
{
  "appId": "cli_a93270046db95bde",
  "brand": "feishu",
  "identities": {
    "bot": { "status": "ready" },
    "user": {
      "status": "ready",
      "openId": "ou_762601e174af53ff28ff3d7acce71c9f",
      "userName": "Taotao Dong",
      "tokenStatus": "valid",
      "expiresAt": "2026-08-24T14:02:29+08:00",
      "refreshExpiresAt": "2026-08-31T12:02:29+08:00",
      "grantedAt": "2026-08-24T12:02:29+08:00"
    }
  },
  "identity": "user"
}
```

共授权 **216 个 scopes**，覆盖全部飞书业务域。

---

## 4. 数据存储结构

### 4.1 存储位置

| 路径 | 内容 | 权限 |
|------|------|------|
| `~/.lark-cli/config.json` | 应用配置 (appId, brand, lang, user) | 600 |
| `~/.lark-cli/cache/remote_meta.meta.json` | 远程元数据缓存 | 644 |
| `~/.lark-cli/locks/` | 刷新锁文件 | 700 |
| `~/.lark-cli/logs/` | 认证日志 | 600 |
| `~/Library/Application Support/lark-cli/master.key.file` | 32 字节主加密密钥 | 600 |
| `~/Library/Application Support/lark-cli/appsecret_cli_<appId>.enc` | 加密的 appSecret (60 bytes) | 600 |
| `~/Library/Application Support/lark-cli/<appId>_<openId>.enc` | 加密的用户凭证 (21.6KB) | 600 |

### 4.2 凭证格式

config.json:
```json
{
  "apps": [{
    "appId": "cli_a93270046db95bde",
    "appSecret": { "source": "keychain", "id": "appsecret:cli_a93270046db95bde" },
    "brand": "feishu",
    "lang": "zh_cn",
    "users": [{ "userOpenId": "ou_...", "userName": "Taotao Dong" }]
  }]
}
```

### 4.3 加密方案

与 wecom-cli **几乎相同的 AES-256-GCM 模式**：

```
appsecret_cli_<appId>.enc = nonce(12) || ciphertext || tag(16)
                              ↑ 随机值     ↑ AES-256-GCM(secret)  ↑ GCM 认证标签

用户凭证 .enc 结构类似，但内容更丰富（包含 refresh_token、scopes 等）
```

master.key.file 是 32 字节原始密钥（非 Base64 编码），这与 wecom-cli 的 Base64 编码密钥不同。

---

## 5. 环境变量覆盖体系

lark-cli 有一个成熟的 env credential provider，可以直接通过环境变量注入凭证，**无需文件存储**：

| 环境变量 | 示例 | 说明 |
|----------|------|------|
| `LARKSUITE_CLI_APP_ID` | `cli_a93270046db95bde` | 应用 ID |
| `LARKSUITE_CLI_APP_SECRET` | `xxx` | 应用 Secret |  
| `LARKSUITE_CLI_BRAND` | `feishu` / `lark` | 品牌 |
| `LARKSUITE_CLI_USER_ACCESS_TOKEN` | `<token>` | 用户访问令牌（绕过登录） |
| `LARKSUITE_CLI_TENANT_ACCESS_TOKEN` | `<token>` | 租户访问令牌（绕过登录） |
| `LARKSUITE_CLI_DEFAULT_AS` | `user` / `bot` / `auto` | 默认身份 |
| `LARKSUITE_CLI_STRICT_MODE` | `bot` / `user` / `off` | 严格模式 |
| `LARKSUITE_CLI_CONFIG_DIR` | `/tmp/lark-cli` | 配置文件目录覆盖 |
| `LARKSUITE_CLI_PROFILE` | `cli_a93270046db95bde` | 多配置选择 |

---

## 6. 逆向萃取凭证方案

### 方案 A：通过环境变量注入（推荐）

在沙箱中启动进程时，通过环境变量设置凭证：

```bash
export LARKSUITE_CLI_APP_ID=cli_a93270046db95bde
export LARKSUITE_CLI_APP_SECRET=<decrypted-secret>
export LARKSUITE_CLI_USER_ACCESS_TOKEN=<decrypted-uat>  # 直接注入UAT，无需走登录流程
export LARKSUITE_CLI_BRAND=feishu
export LARKSUITE_CLI_DEFAULT_AS=user
lark-cli im message send ...
```

**优势**：零文件依赖，纯环境变量驱动，适合沙箱场景。

### 方案 B：解密加密文件后使用

1. 读取 `master.key.file`（32 字节原始密钥）
2. 读取 `appsecret_cli_<appId>.enc`，AES-256-GCM 解密得到 appSecret
3. 读取 `<appId>_<openId>.enc`，解密得到 refresh_token / UAT
4. 如有必要，用 refresh_token 换新的 UAT
5. 通过环境变量 `LARKSUITE_CLI_APP_ID` + `LARKSUITE_CLI_APP_SECRET` + `LARKSUITE_CLI_USER_ACCESS_TOKEN` 注入

### 方案 C：侧边车模式（最完善，但需要额外服务进程）

沙箱侧（authsidecar 构建）：
```bash
LARKSUITE_CLI_AUTH_PROXY=http://127.0.0.1:16384 \
LARKSUITE_CLI_PROXY_KEY=<shared-hmac-key> \
LARKSUITE_CLI_APP_ID=cli_a93270046db95bde \
LARKSUITE_CLI_BRAND=feishu \
./lark-cli-sandbox <commands>
```

凭证托管侧：
```bash
# 真实凭证环境 + sidecar 服务
LARKSUITE_CLI_APP_ID=cli_a93270046db95bde \
LARKSUITE_CLI_APP_SECRET=<decrypted-secret> \
LARKSUITE_CLI_BRAND=feishu \
# 运行 sidecar 代理服务
./sidecar-server
```

**优势**：真正的隔离架构，沙箱内没有任何凭证；适合多租户、审计场景。
**代价**：需要额外运行一个 sidecar 进程，且沙箱外的关键 API 调用（如初始化授权）也需要走 sidecar。

---

## 7. 与 wecom-cli 对比

| 维度 | lark-cli (飞书) | wecom-cli (企业微信) | 分析 |
|------|-----------------|---------------------|------|
| 编程语言 | Go | Rust | 均为编译型语言，二进制分发 |
| 二进制大小 | ~46MB | ~8.2MB | 功能覆盖范围差异 |
| 加密算法 | AES-256-GCM | AES-256-GCM | **完全一致** |
| Nonce 大小 | 12 bytes | 12 bytes | 相同 |
| 认证标签 | 16 bytes | 16 bytes | 相同 |
| 密钥存储 | master.key.file (32B 原始) + Keychain | .encryption_key (Base64 44B) + Keychain | 格式略有不同但本质相同 |
| 凭证类型 | App (app_id + app_secret) + 用户 UAT | Bot (bot.id + bot.secret) + Bearer Token | 概念对应 |
| 环境变量注入 | ✅ 丰富完整 | ❌ 仅 CONFIG_DIR 覆盖 | **lark-cli 明显更完善** |
| 沙箱/侧边车架构 | ✅ 原生构建 tag 完整实现 | ❌ 无 | **lark-cli 领先** |
| CI/CD 友好 | ✅ --no-wait / --json | ✅ --noninteractive | 两者都支持 |
| 交互式授权 | 设备码扫码 / URL | 扫码 / 手动输入 Bot Secret | 方式不同 |
| 文件存储位置 | `~/.lark-cli/` + `~/Library/Application Support/lark-cli/` | `~/.config/wecom/` | 路径不同 |
| 解密所需信息 | master.key.file + 密文 | .encryption_key + credentials.enc | **解密流程一致** |
| 响应日志 | ✅ 内置 auth 日志记录 | ❌ 未发现 | lark-cli 有审计日志 |

---

## 8. 推荐方案

### 短期：方案 A（环境变量注入）

1. 读取 `master.key.file` → 解密 `appsecret_cli_*.enc` 得到 appSecret
2. 解密用户凭证文件得到 refresh_token / UAT（或使用 refresh_token 刷新新 UAT）
3. 用环境变量注入凭证，在沙箱中运行 lark-cli

### 长期：方案 C（侧边车模式）

利用 lark-cli 已实现的 `authsidecar` build tag + sidecar 代理服务，实现完全隔离的沙箱架构。

### 关键代码位置（源码）

| 模块 | 路径 | 说明 |
|------|------|------|
| 主入口 | `main.go` | 标准构建入口，激活 env 凭证 |
| Sidecar 入口 | `main_authsidecar.go` | authsidecar 构建入口 |
| 无 sidecar 校验 | `main_noauthsidecar.go` | 检测 `LARKSUITE_CLI_AUTH_PROXY` 拒绝运行 |
| 环境变量凭证 | `extension/credential/env/env.go` | 从 env 读取凭证 |
| Sidecar 凭证 | `extension/credential/sidecar/provider.go` | 返回 placeholder 凭证 |
| 传输拦截器 | `extension/transport/sidecar/interceptor.go` | 重写请求到 sidecar |
| 侧边车协议 | `sidecar/protocol.go` | HMAC 签名 / 校验 / 地址验证 |
| Sidecar 示例服务 | `sidecar/server-demo/` | 单租户 demo |
| 多租户侧边车 | `sidecar/server-multi-tenant-demo/` | 多租户 demo |
| 凭证存储读取 | `internal/credential/default_provider.go` | keychain 凭证解析 |
| 加密解密 | `internal/keychain/` | keychain + 文件加密存储 |
| 设备流认证 | `internal/auth/` | 应用注册 + 用户授权 |
| 环境变量定义 | `internal/envvars/` | 所有支持的 env var 常量 |
| auth login 命令 | `cmd/auth/login.go` | `lark-cli auth login` 实现 |
| auth config 命令 | `cmd/auth/auth.go` | auth 命令入口 |
| 安装向导 | `scripts/install-wizard.js` | 交互式安装（含应用配置 + 授权） |
| 二进制下载 | `scripts/install.js` | 下载原生二进制 + SHA-256 校验 |
| Node 启动器 | `scripts/run.js` | 拦截 install 命令，exec 原生二进制 |
