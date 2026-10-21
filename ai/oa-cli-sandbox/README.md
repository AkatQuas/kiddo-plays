# oa-cli-sandbox

> **免责声明**：本目录内容仅供个人学习与技术研究，不构成生产环境方案或安全建议。请遵守各产品服务条款与相关法律法规；勿将解密脚本或报告中的凭证信息用于未授权访问、传播或任何非法用途。使用本材料造成的任何后果由使用者自行承担。

飞书 / 企业微信 / 钉钉官方 CLI 的**源码调研与沙箱集成笔记**。目标是弄清各 CLI 的凭证存储与加密方式，并给出在 Docker / Agent 沙箱中复用已授权凭证的可行方案。

本目录**不含**三家 CLI 的源码本身，只有分析报告与本地解密辅助脚本。

## 目录结构

```
oa-cli-sandbox/
├── README.md                        # 本文件
├── lark-cli-report.md               # 飞书 @larksuite/cli 调研
├── lark-cli-installation-guide.md   # 飞书 CLI 安装（面向 Agent）
├── lark-decrypt.js                  # 飞书本地凭证解密
├── wecom-cli-report.md              # 企业微信 @wecom/cli 调研
├── wecom-decrypt.js                 # 企微本地凭证解密
└── dingtalk-dws-report.md           # 钉钉 @dingtalk/dws 沙箱方案
```

## 三家 CLI 一览

| | 飞书 `lark-cli` | 企微 `wecom-cli` | 钉钉 `dws` |
|---|---|---|---|
| npm / 包 | `@larksuite/cli` | `@wecom/cli` | `@dingtalk/dws` |
| 主语言 | Go | Rust | Go |
| 调研报告 | [lark-cli-report.md](./lark-cli-report.md) | [wecom-cli-report.md](./wecom-cli-report.md) | [dingtalk-dws-report.md](./dingtalk-dws-report.md) |
| 解密脚本 | [lark-decrypt.js](./lark-decrypt.js) | [wecom-decrypt.js](./wecom-decrypt.js) | 无（优先官方 `export/import`） |
| 仓库 | [larksuite/cli](https://github.com/larksuite/cli) | [WecomTeam/wecom-cli](https://github.com/WecomTeam/wecom-cli) | [dingtalk-workspace-cli](https://github.com/DingTalk-Real-AI/dingtalk-workspace-cli) |

共性：本地凭证多为 **AES-256-GCM**，密文格式 `nonce(12) ‖ ciphertext ‖ tag(16)`；Linux / Docker 下密钥与密文都在文件里，便于挂载或导出。

## 沙箱集成结论（摘要）

### 企业微信 — 文件密钥 + 解密复用

1. 宿主机扫码：`wecom-cli auth init`
2. 凭证落在 `~/.config/wecom/`（`.encryption_key` + `credentials.enc`）
3. 用 `wecom-decrypt.js` 解出 `bot.id` / `bot.secret` / `token`，再注入沙箱

详见 [wecom-cli-report.md](./wecom-cli-report.md)。

### 飞书 — 环境变量注入，或官方 sidecar

短期：解密后通过 `LARKSUITE_CLI_*` 环境变量注入（无需拷贝 keychain 文件）。

长期：源码已有 `authsidecar` 构建标签，沙箱内只持有 placeholder，真实凭证由本机 sidecar 代理注入（HMAC 签名）。

安装步骤见 [lark-cli-installation-guide.md](./lark-cli-installation-guide.md)；完整分析见 [lark-cli-report.md](./lark-cli-report.md)。

### 钉钉 DWS — 官方 export/import（首选）

Linux / Docker 默认走**文件 DEK**（不绑定 MAC）。推荐流程：

```bash
# 宿主机
dws auth login
dws auth export --base64 -o dws-auth.b64   # macOS 需先 file-dek / DWS_DISABLE_KEYCHAIN=1

# 容器
dws auth import --base64 -i dws-auth.b64
dws auth status
```

备选：逆向读 `dek` + `auth-token.enc`，或用 hidden `--token` 注入短期 token。详见 [dingtalk-dws-report.md](./dingtalk-dws-report.md)。

## 解密脚本用法

需已完成本机授权；Node.js 即可运行。

```bash
# 企业微信 → 打印 bot / token
node wecom-decrypt.js

# 飞书 → 打印 AppSecret / UAT，并输出可 eval 的 export 行
node lark-decrypt.js

# 将飞书凭证注入当前 shell 后调用 CLI（示例）
eval "$(node lark-decrypt.js | grep '^  export ' | sed 's/^  //')"
lark-cli auth status
```

| 脚本 | 默认读取路径 |
|------|----------------|
| `wecom-decrypt.js` | `~/.config/wecom/.encryption_key`、`credentials.enc` |
| `lark-decrypt.js` | `~/.lark-cli/config.json`；密钥优先 `~/Library/Application Support/lark-cli/master.key.file`，否则 macOS Keychain |

## 阅读建议

1. 先看本 README 的对比表，确认目标产品。
2. 读对应 `*-report.md`：包架构 → 凭证与加密 → 沙箱方案。
3. 需要落地时再跑对应 `*-decrypt.js`，或按钉钉报告用官方 `export/import`。

## 安全注意

- 解密脚本会输出**明文密钥与 token**，仅用于本机调试 / 沙箱编排，勿提交到 git 或日志。
- 报告中可能含调研时本机样例凭证，视为敏感信息，勿外传；泄露后应在开放平台重置。
- 密钥与密文常同目录存放，配置目录权限应保持 `700` / 文件 `600`。

## 调研版本快照

| 产品 | 报告中的版本 | 调研日期（报告内） |
|------|-------------|-------------------|
| `@larksuite/cli` | 1.0.89 | 2027-02-13 |
| `@wecom/cli` | 1.1.0 | 2025-07-17 |
| `@dingtalk/dws` | 1.0.59 | 2026-08-25 |

上游更新后，加密路径或 env 名可能变化，以各仓库源码为准。
