# @wecom/cli (wecom-cli) 调研报告

> 调研日期：2025-07-17
> 包版本：1.1.0

---

## 1. 包概述

`@wecom/cli` 是**企业微信官方命令行工具**，使用 **Rust** 编写，通过 npm 分发为平台相关二进制。

| 项目 | 内容 |
|------|------|
| 包名 | `@wecom/cli` |
| 版本 | 1.1.0 |
| 许可证 | MIT |
| 仓库 | <https://github.com/WecomTeam/wecom-cli> |
| 描述 | 企业微信命令行工具，覆盖消息、邮件、文档、待办、日程、会议、微盘、通讯录等业务功能 |
| 编程语言 | Rust (主二进制), JavaScript (启动 loader) |
| 平台支持 | macOS (x64/arm64), Linux (x64/arm64), Windows (x64) |
| Node.js 要求 | >= 18 |

### 架构示意

```
npm i -g @wecom/cli
       ↓
  bin/wecom.js         ← Node.js 薄壳，检测平台
       ↓
  @wecom/cli-darwin-x64
  bin/wecom-cli        ← Rust 原生二进制 (~8.2MB Mach-O)
```

---

## 2. 功能范围

覆盖企业微信核心业务品类：

| 品类 | 能力 |
|------|------|
| 💬 消息 | 向机器人最近对话过的单聊/群聊主动推送消息，支持 Markdown/图片/文件/语音/视频消息 |
| 📧 邮件 | 邮件发送/回复/转发，邮件搜索，获取邮件内容详情 |
| 📄 文档 | 在线文档的新建、导入、读取、追加与覆盖写入 |
| 🗂️ 文档管理 | 多种文档类型的搜索、重命名、成员权限与加入规则管理 |
| 📊 在线表格 | 新建、CSV/Excel 导入、内容读改、追加行、子表管理 |
| 🧮 智能表格 | 创建，子表/字段/记录/视图/图表管理，行列样式修改 |
| 📰 智能文档 | 创建、获取页面内容、编辑文档内容、内置数据表信息获取 |
| ✅ 待办 | 创建/读取/更新/删除待办，分派参与人与完成待办 |
| 📅 日程 | 日程增删改查、参与人管理、多成员闲忙查询、会议室查询预订 |
| 🎥 会议 | 创建预约会议、取消会议、更新参会人、查询列表与详情、读取会议纪要与转写原文 |
| 💾 微盘 | 文件搜索、基础信息读取、上传、下载 |
| 👤 通讯录 | 按姓名/拼音/别名搜索成员，获取成员基本信息 |

---

## 3. 认证机制 (`wecom-cli auth init`)

### 3.1 认证方式

| 方式 | 命令 | 说明 |
|------|------|------|
| 🔐 扫码登录 (默认) | `wecom-cli auth init` | 用企业微信 App 扫码授权 |
| ⌨️ 手动输入 | `wecom-cli auth init --manual` | 手动输入 Bot ID 和 Bot Secret |
| 🤖 非交互模式 | `wecom-cli auth init --noninteractive` | 扫码方式接入，适合 CI/自动化环境 |

### 3.2 凭证本质

凭证是**企业微信智能机器人 (Bot)** 的凭据，包含：

| 凭证字段 | 示例值 | 说明 |
|---------|--------|------|
| `bot.id` | `aibfzSS02eTXI--yTz2NTmKO49bk2fUMZ00` | 机器人唯一标识 |
| `bot.secret` | `wfsvxDOwzfIpPTwv4xsI5OeBneMvYmBPqbmgA68Z0Jr` | 机器人密钥 |
| `bot.create_time` | `1787300106` | 创建时间 (Unix 时间戳) |
| `token` | `lgnQikhbYac83a2u0DfAJ+Up++18FDfYPjRKPwphStc=` | Bearer Token (API 访问令牌) |

> Bot ID 和 Secret 获取方式：企业微信开放平台 → 智能机器人 → 创建机器人

---

## 4. 数据存储

### 4.1 存储位置

凭证存储在 `~/.config/wecom/` 目录下（遵循 XDG Base Directory 规范）：

```
~/.config/wecom/
├── .encryption_key          # 加密密钥 (Base64, 44 字符, 解码后 32 字节)
├── credentials.enc          # 加密后的凭证数据 (AES-256-GCM 加密)
└── cache/
    └── catalog.json         # 服务发现缓存 (14 个服务品类)
```

### 4.2 文件权限

- `.encryption_key` — `-rw-------` (0o600)
- `credentials.enc` — `-rw-------` (0o600)
- `cache/` — `drwx------` (0o700)

### 4.3 环境变量覆盖

可通过环境变量 `WECOM_CLI_CONFIG_DIR` 覆盖配置目录路径（测试用）。

---

## 5. 加密方案详解

### 5.1 算法

- **加密算法**: AES-256-GCM (256 位密钥)
- **Nonce 大小**: 12 字节 (96 bits)
- **认证标签大小**: 16 字节 (128 bits)
- **密钥存储**: 文件回退 (`~/.config/wecom/.encryption_key`) + macOS Keychain

### 5.2 数据格式

```
credentials.enc = nonce(12) || ciphertext || tag(16)
                    ↑ 随机值     ↑ AES-256-GCM    ↑ GCM 认证标签
```

### 5.3 加密流程

1. 生成随机 256-bit 密钥或从已存在的 `.encryption_key` / Keychain 加载
2. 将凭证序列化为 JSON
3. 生成 12 字节随机 nonce
4. 使用 AES-256-GCM 加密 JSON 明文
5. 输出 `nonce(12) || ciphertext || tag(16)`

### 5.4 解密流程

1. 从 `.encryption_key` 读取 Base64 编码的 32 字节密钥
2. 从 `credentials.enc` 读取密文
3. 提取前 12 字节作为 nonce
4. 提取最后 16 字节作为 GCM 认证标签
5. 中间部分为 ciphertext
6. 用 AES-256-GCM 解密，认证失败则报错

> 优先使用文件密钥解密，文件密钥失效时回退到 macOS Keychain。

### 5.5 解密脚本 (Node.js)

```javascript
const crypto = require('node:crypto');
const fs = require('node:fs');

// 读取 Base64 密钥 → 32 字节 key
const key = Buffer.from(
  fs.readFileSync('~/.config/wecom/.encryption_key', 'utf-8').trim(),
  'base64'
);

// 读取密文
const data = fs.readFileSync('~/.config/wecom/credentials.enc');

// 拆分 nonce || ciphertext || tag
const nonce = data.subarray(0, 12);
const tag = data.subarray(data.length - 16);
const ciphertext = data.subarray(12, data.length - 16);

// AES-256-GCM 解密
const decipher = crypto.createDecipheriv('aes-256-gcm', key, nonce);
decipher.setAuthTag(tag);
const plaintext = Buffer.concat([
  decipher.update(ciphertext),
  decipher.final()
]);

// 输出 JSON
console.log(plaintext.toString('utf-8'));
```

---

## 6. 源码结构 (关键模块)

```
crates/wecom-cli/src/auth/
├── mod.rs              # auth 模块入口
├── credentials.rs      # credentials.enc 读写 (load/save/clear)
├── bot.rs              # Bot 信息结构体
├── token.rs            # Bearer Token 管理
├── bootstrap.rs        # auth init 认证引导流程
├── qrcode.rs           # 扫码登录 (二维码显示/轮询)
├── legacy_migration.rs # 旧版 bot.enc/token.enc 迁移
├── crypto/
│   ├── mod.rs          # crypto 模块入口, atomic_write 工具
│   ├── cipher.rs       # AES-256-GCM 原始加解密原语
│   └── keystore.rs     # 密钥生成/加载/保存, 加解密辅助
└── cmd/auth.rs         # "wecom-cli auth" CLI 命令实现
```

---

## 7. 当前机器授权状态

```
$ wecom-cli auth show
Status: authorized
Bot ID: aibfzSS02eTXI--yTz2NTmKO49bk2fUMZ00
```

解密后凭证内容：

```json
{
  "bot": {
    "id": "aibfzSS02eTXI--yTz2NTmKO49bk2fUMZ00",
    "secret": "wfsvxDOwzfIpPTwv4xsI5OeBneMvYmBPqbmgA68Z0Jr",
    "create_time": 1787300106
  },
  "token": "lgnQikhbYac83a2u0DfAJ+Up++18FDfYPjRKPwphStc="
}
```

---

## 8. 安全建议

1. **`.encryption_key` 和 `credentials.enc` 本质是加密存储，密钥和密文在同一目录**，有权限的进程可以解密所有凭证，应确保 `~/.config/wecom/` 目录权限严格 (`700`)
2. macOS Keychain 作为密钥回退存储，比文件存储更安全，建议确保 Keychain 存储正常运作
3. 凭证明文包含 Bot Secret 和 Bearer Token，泄露后应尽快在企业微信开放平台重置
4. 如果将 `wecom-cli` 用于 CI/CD，建议使用 `--noninteractive` 扫码模式，避免密钥文本暴露

---

## 附录 A: CLI 命令一览

```
wecom-cli auth [init|show]    授权管理
wecom-cli calendar [...]      日历服务
wecom-cli chat [...]          聊天会话
wecom-cli contact [...]       通讯录
wecom-cli disk [...]          微盘
wecom-cli doc [...]           文档
wecom-cli mail [...]          邮件
wecom-cli media [...]         媒体文件
wecom-cli message [...]       消息
wecom-cli meeting [...]       会议
wecom-cli sheet [...]         表格
wecom-cli smartpage [...]     智能主页
wecom-cli smartsheet [...]    智能表格
wecom-cli todo [...]          待办
```

## 附录 B: 参考链接

- npm 包: <https://www.npmjs.com/package/@wecom/cli>
- GitHub 仓库: <https://github.com/WecomTeam/wecom-cli>
- 企业微信开放平台: <https://open.work.weixin.qq.com/>
- 智能机器人 Secret 获取: <https://open.work.weixin.qq.com/help2/pc/cat?doc_id=21677>
