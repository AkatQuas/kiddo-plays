# @dingtalk/dws (dingtalk-workspace-cli) 沙箱集成方案调研

> 调研日期：2026-08-25  
> 包版本：1.0.59  
> 源码仓库：<https://github.com/DingTalk-Real-AI/dingtalk-workspace-cli>  
> 分支：main

---

## 1. 背景：Wecom 已落地模式

企业微信 wecom-cli 的沙箱集成做法是：

```
沙箱内置 wecom-cli 工具
       ↓
首次使用: 用户扫码授权
  → 生成 ~/.config/wecom/
  ├── .encryption_key (Base64 → 32B 密钥)
  └── credentials.enc (AES-256-GCM 密文)
       ↓
后续使用: wecom-decrypt.js 逆向解密
  读取 .encryption_key + credentials.enc
  → nonce(12) || ciphertext || tag(16)
  → { bot.id, bot.secret, token }
       ↓
注入环境变量或直接使用
```

**核心条件**：Linux 上密钥和密文都是文件，不绑定硬件，跨机复制可解密。

---

## 2. DingTalk DWS 凭证存储架构

dws 的凭证存储**有三个层次**，理解它们的差异是沙箱方案的关键。

### 2.1 层次一：MAC 绑定加密（默认 macOS 路径）

| 路径 | 说明 |
|------|------|
| `~/.dws/<corpId:userId>/.data` | PBKDF2(MAC) + AES-256-GCM 密文 |

**加密流程**（`internal/security/crypto.go` + `internal/auth/secure_store.go`）：

```go
// 加密密码 = 设备物理 MAC 地址
password = getMACAddress()           // e.g. "a8:5e:45:xx:xx:xx"
key = PBKDF2(password, salt, 600000) // 60 万次迭代！
ciphertext = AES-256-GCM(key, nonce, plaintext)
// 输出: salt(32) || nonce(12) || ciphertext+tag(16) → .data 文件
```

**特点**：
- ✅ 跨机**无法**解密（MAC 不同 → PBKDF2 派生密钥不同 → GCM 认证失败）
- ✅ 安全性最高（600k 次 PBKDF2 + MAC 绑定）
- ❌ 沙箱内 `DWS_CONFIG_DIR` 指向宿主机导出的 `.data` 文件也无法解密
- ❌ **Docker 容器内默认不走此路径**（Linux 上各自有各自的 keychain 实现）

> 注意：这段路径影响的是 macOS 上的 dws 用户。**Docker 镜像运行在 Linux 上**，没有 macOS Keychain，所以默认走下一节的文件 DEK 路径。

### 2.2 层次二：文件 DEK（默认 Linux 路径 —— Docker 容器的实际路径）

Linux 上（包括 Docker 容器内）没有 macOS Keychain，dws 使用文件 DEK（Data Encryption Key）作为凭证存储后端。

| 路径 | 说明 |
|------|------|
| `~/.local/share/dws-cli/dws/dek` | 32 字节随机密钥（**不绑定 MAC**） |
| `~/.local/share/dws-cli/dws/auth-token.enc` | AES-256-GCM 密文，密钥来自 `dek` 文件 |

**加密流程**（`internal/keychain/keychain_linux.go` + `internal/keychain/file_dek.go`）：

```go
// Linux keychain 实现 — Docker 容器内实际走的路径
dek = rand(32)           // 随机生成，写入 ~/.local/share/dws-cli/dws/dek
ciphertext = AES-256-GCM(dek, nonce, plaintext)
// → ~/.local/share/dws-cli/dws/auth-token.enc
// 格式: nonce(12) || ciphertext || tag(16)
```

**特点**：
- ✅ 跨机可解密（复制 `dek` + `auth-token.enc` 即可）
- ✅ **与 wecom-cli 完全一致的文件加密模式**
- ✅ **没有 MAC 绑定**，Docker 容器的虚拟 MAC（`02:42:xx`）完全不影响
- ✅ Docker 镜像**无需额外配置**，开箱即用
- macOS 上通过 `DWS_DISABLE_KEYCHAIN=1` 也可启用此模式

### 2.3 层次三：Portable Store（官方跨机迁移工具）

`internal/auth/portable_store.go` 实现了官方的 `dws auth export/import`。这是**宿主机 → Docker 容器**凭证传递的最佳路径。

```
宿主机 A (有授权)
dws auth export -o dws-auth.tar.gz
  ├── manifest.json
  ├── keychain/dws/dek          ← 随机 DEK
  ├── keychain/dws/auth-token.enc  ← DEK 加密的 token（含 refresh_token）
  └── config/app.json, profiles.json, ...

Docker 容器 B
dws auth import -i dws-auth.tar.gz
  → 写入 ~/.local/share/dws-cli/dws/dek
  → 写入 ~/.local/share/dws-cli/dws/auth-token.enc
  → 写入 ~/.dws/app.json, profiles.json, ...
dws auth status  → "Refresh Token: valid"
```

**特点**：
- ✅ 官方支持，一键迁移
- ✅ 自动处理多 profile
- ✅ BASE64 格式便于 env var 传递
- ✅ 自动验证 bundle 完整性

---

## 3. Token 数据结构（`internal/auth/token.go`）

```go
type TokenData struct {
    AccessToken    string    `json:"access_token"`
    RefreshToken   string    `json:"refresh_token"`
    PersistentCode string    `json:"persistent_code"`
    ExpiresAt      time.Time `json:"expires_at"`
    RefreshExpAt   time.Time `json:"refresh_expires_at"`
    CorpID         string    `json:"corp_id"`
    UserID         string    `json:"user_id,omitempty"`
    UserName       string    `json:"user_name,omitempty"`
    CorpName       string    `json:"corp_name,omitempty"`
    ClientID       string    `json:"client_id,omitempty"`
    UpdatedAt      string    `json:"updated_at,omitempty"`
    Source         string    `json:"source,omitempty"`
    LoginRegion    string    `json:"login_region,omitempty"`
}
```

**关键字段**：`RefreshToken` 是长期有效的凭证（通常 7 天 ~ 30 天），`AccessToken` 短期（约 2 小时）。沙箱内只要有 `refresh_token`，dws 就能自动刷新，无需外部干预。

---

## 4. Docker 沙箱集成方案

### 前置知识：Docker 环境的关键推断

| 问题 | 答案 | 代码证据 |
|------|------|---------|
| Docker 容器走哪个加密路径？ | **文件 DEK**（keychain_linux.go），不碰 MAC | `//go:build linux` + `getDEK() → fileDEK()` |
| Docker MAC 是 `02:42:xx`，会有问题？ | **完全不影响**。Linux 路径用随机 DEK，不依赖 MAC | `keychain_linux.go` 没有 `selectMAC()` 调用 |
| 需要设 `DWS_DISABLE_KEYCHAIN=1`？ | **不需要**。Linux 默认就是文件 DEK | Linux build tag 下有独立的 `platformGet` |
| 凭证文件放哪里？ | `~/.local/share/dws-cli/dws/` | `StorageDir()` 按 XDG 规范拼接 |
| 容器的 `~` 是临时的怎么办？ | `DWS_KEYCHAIN_DIR` 控制 keychain 路径；`DWS_CONFIG_DIR` 控制配置路径 | `StorageDirEnv` + `getDefaultConfigDir()` |
| 宿主机 OS 是 macOS 能导出吗？ | 可以，但 macOS 需 `DWS_DISABLE_KEYCHAIN=1` | `portableExportSupportError()` 检查 |

---

### 方案 A：官方 `dws auth export/import`（**推荐，首选**）

利用 dws 官方提供的跨机迁移能力，这是**最稳健、最被上游支持**的方案。宿主机（可能是 macOS）完成授权并导出，Docker 容器（Linux）直接导入。

#### 宿主机凭证导出

```bash
# ===== 宿主机（可以是 macOS 或 Linux）=====

# 1. 首次授权（仅一次）
dws auth login

# 2. 导出凭证包
# tar.gz 格式（文件卷挂载）:
dws auth export -o dws-auth.tar.gz
# base64 格式（环境变量传递，适合无 volume 场景）:
dws auth export --base64 -o dws-auth.b64
```

> **⚠️ macOS 宿主请注意**：macOS 上 `dws auth export` 要求走文件 DEK 模式。如果默认 keychain 模式导出会报错：
> ```
> portable export requires file-DEK mode on macOS; set DWS_DISABLE_KEYCHAIN=1
> ```
> 解决方案：
> ```bash
# 迁移 keychain 凭证到文件 DEK（先 dry-run 确认）
env -u DWS_DISABLE_KEYCHAIN dws auth migrate-keychain --to file-dek --dry-run
# 确认没问题后执行迁移
env -u DWS_DISABLE_KEYCHAIN dws auth migrate-keychain --to file-dek --yes
# 验证
DWS_DISABLE_KEYCHAIN=1 dws auth status --format json
# 现在可以导出了
DWS_DISABLE_KEYCHAIN=1 dws auth export --base64 -o dws-auth.b64
```

#### 镜像构建

```dockerfile
# Dockerfile
FROM alpine:3.19

# 安装依赖（dws 需要 libc）
RUN apk add --no-cache ca-certificates libc6-compat

# 下载并安装 dws 二进制
ARG DWS_VERSION=v1.0.59
RUN wget -q https://github.com/DingTalk-Real-AI/dingtalk-workspace-cli/releases/download/${DWS_VERSION}/dws-linux-amd64.tar.gz \
    && tar xzf dws-linux-amd64.tar.gz \
    && mv dws /usr/local/bin/dws \
    && rm dws-linux-amd64.tar.gz

# 配置容器内凭证存储路径（临时目录，避免写 home）
# Linux 上不设 DWS_DISABLE_KEYCHAIN，默认就是文件 DEK
ENV DWS_CONFIG_DIR=/tmp/dws-config
# 可选：DWS_KEYCHAIN_DIR 控制 keychain 存储位置
# ENV DWS_KEYCHAIN_DIR=/tmp/dws-keychain

# 预装 dws Skills（Agent 场景需要）
# Skills 来自 dws-skills.zip，可解压到 ~/.agents/skills/

COPY sandbox-entrypoint.sh /entrypoint.sh
ENTRYPOINT ["/entrypoint.sh"]
```

#### 沙箱入口脚本

```bash
#!/bin/sh
# sandbox-entrypoint.sh — 运行在 Docker 容器内

# 从环境变量导入凭证（如果传入）
# docker run -e DWS_AUTH_BUNDLE="$(cat dws-auth.b64)" ...
if [ -n "$DWS_AUTH_BUNDLE" ]; then
    # 尝试先当 base64 解，再当 tar.gz 解
    echo "$DWS_AUTH_BUNDLE" > /tmp/dws-auth.b64
    dws auth import -i /tmp/dws-auth.b64 --base64 2>/dev/null || {
        # 如果 import 失败，可能是 tar.gz 格式
        echo "$DWS_AUTH_BUNDLE" | base64 -d > /tmp/dws-auth.tar.gz 2>/dev/null
        dws auth import -i /tmp/dws-auth.tar.gz
    }
fi

# 从挂载的文件导入凭证（如果传入）
# docker run -v ./dws-auth.tar.gz:/tmp/dws-auth.tar.gz:ro ...
if [ -f /tmp/dws-auth.tar.gz ]; then
    dws auth import -i /tmp/dws-auth.tar.gz
elif [ -f /tmp/dws-auth.b64 ]; then
    dws auth import -i /tmp/dws-auth.b64 --base64
fi

# 验证凭证
if ! dws auth status --format json 2>/dev/null | grep -q '"status":"authorized"'; then
    echo "❌ No valid credentials." >&2
    echo "   Provide DWS_AUTH_BUNDLE env var or mount auth bundle to /tmp/" >&2
    exit 1
fi

# 执行传入的命令
exec "$@"
```

#### 运行容器

```bash
# 方式一：环境变量传递（最便利）
docker run --rm \
    -e DWS_AUTH_BUNDLE="$(cat /tmp/dws-auth.b64)" \
    my-dws-sandbox \
    dws contact user search --query "张三" --yes

# 方式二：文件卷挂载
docker run --rm \
    -v /tmp/dws-auth.tar.gz:/tmp/dws-auth.tar.gz:ro \
    my-dws-sandbox \
    dws calendar event list -f json

# 方式三：长期运行容器 + volume 持久化凭证
docker volume create dws-credentials
docker run -d \
    -v dws-credentials:/tmp/dws-config \
    -v dws-credentials:/tmp/dws-keychain \
    my-dws-sandbox \
    dws event consume user_im_message_receive_o2o -f ndjson
```

---

### 方案 B：逆向解密文件 DEK（类 Wecom 做法）

如果沙箱内没有 `dws` 二进制，或者需要用其他语言直接读取凭证，可以直接像 wecom 一样逆向解密。

```javascript
// dws-decrypt.js — 类 wecom-decrypt.js 做法
// 适用条件：Linux Docker 容器（默认就是文件 DEK 模式）
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const homeDir = require('os').homedir();
// 注意：如果容器内设置了 DWS_KEYCHAIN_DIR，路径会不同
const keychainDir = process.env.DWS_KEYCHAIN_DIR
    || path.join(homeDir, '.local', 'share', 'dws-cli', 'dws');

// 1. 读取 DEK（32 字节随机密钥）
const dek = fs.readFileSync(path.join(keychainDir, 'dek'));

// 2. 读取 token 密文
const data = fs.readFileSync(path.join(keychainDir, 'auth-token.enc'));

// 3. 解析格式: nonce(12) || ciphertext || tag(16)
const NONCE_SIZE = 12;
const TAG_SIZE = 16;
const nonce = data.subarray(0, NONCE_SIZE);
const ciphertext = data.subarray(NONCE_SIZE, data.length - TAG_SIZE);
const tag = data.subarray(data.length - TAG_SIZE);

// 4. AES-256-GCM 解密
const decipher = crypto.createDecipheriv('aes-256-gcm', dek, nonce);
decipher.setAuthTag(tag);
const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
const creds = JSON.parse(plaintext.toString('utf-8'));

console.log(JSON.stringify(creds, null, 2));
// → { access_token, refresh_token, corp_id, user_id, ... }
```

---

### 方案 C：`--token` 直接注入（最简方案）

dws 有 hidden flag `--token`，可以直接注入 access_token，**完全绕过所有加密/Keychain/文件逻辑**（`internal/app/access_token_resolve.go`）：

```go
func (m *TokenManager) Get(ctx context.Context, configDir, explicitToken string) (AccessTokenSnapshot, error) {
    if token := strings.TrimSpace(explicitToken); token != "" {
        // 直接返回！不碰文件、Keychain、MAC 解密
        return AccessTokenSnapshot{AccessToken: token, Source: "explicit"}, nil
    }
    // ... 否则走完整解密刷新流程
}
```

```bash
# Docker 最简用法
docker run --rm my-dws-sandbox \
    dws --token <access_token> contact user search --query "张三" --yes
```

**特点**：
- ✅ 实现最简单，零文件依赖
- ✅ `--token` flag 虽然 hidden 但**完全可用**
- ❌ access_token 有效期短（约 2 小时），需频繁刷新
- ❌ 沙箱内没有 refresh_token，过期必须由外部重新注入

---

## 5. Docker 与云端无主机沙箱对比

| 场景 | Docker 沙箱 | 云端 Agent 沙箱 |
|------|------------|----------------|
| 底层 OS | ✅ Linux（文件 DEK 默认） | ✅ Linux（文件 DEK 默认） |
| MAC 地址 | 虚拟 `02:42:xx`（不影响） | 虚拟（不影响） |
| 持久存储 | ✅ volume 可持久化凭证 | ❌ 通常无持久化，需每次注入 |
| 宿主机有 dws 吗？ | ✅ 可有，直接跑 `export` | ⚠️ 不一定，需单独凭证服务 |
| 凭证传递方式 | volume / env var / file | API / stdin / env var |
| Token 刷新 | ✅ 容器内自动（有 refresh_token 即可） | ✅ 自动（import 后就有） |
| 多容器共享凭证 | ✅ volume 共享 keychain 目录 | ❌ 每个沙箱独立注入 |

---

## 6. 三种方案对比

| 维度 | A: export/import | B: 逆向解密 DEK | C: --token 注入 |
|------|:---:|:---:|:---:|
| 官方支持度 | ✅ 官方命令 | ⚠️ 非官方（逆向） | ⚠️ hidden flag 但有效 |
| 实现复杂度 | ⭐（一行命令） | ⭐⭐（需解密脚本） | ⭐（最简单） |
| 跨机凭证传递 | ✅ tar.gz / base64 | ✅ 复制文件 | ✅ 无文件依赖 |
| Token 刷新 | ✅ 沙箱内自动 | ✅ 沙箱内自动 | ❌ 外宿主机负责 |
| 多 profile | ✅ 自动处理 | ⚠️ 需逐个处理 | ❌ 单 token |
| 沙箱内依赖 | `dws` 二进制 | `dws` 或 decrypt 脚本 | `dws` 二进制 |
| 凭证暴露 | 最低（加密传输） | 最低（加密传输） | 中等（token 明文） |
| 长会话支持 | ✅ 可运行数天 | ✅ 可运行数天 | ⚠️ 每次重启需新 AT |
| Docker 适配 | ✅ 天然适配 | ✅ 天然适配 | ✅ 天然适配 |

---

## 7. Docker 最佳实践总结

```bash
# 宿主机（首次，仅一次）
dws auth login
dws auth export --base64 -o /tmp/dws-auth.b64      # Linux 直接导出
# macOS: DWS_DISABLE_KEYCHAIN=1 dws auth export ...

# 构建镜像
docker build -t my-dws-sandbox .

# 每次使用
docker run --rm \
    -e DWS_AUTH_BUNDLE="$(cat /tmp/dws-auth.b64)" \
    my-dws-sandbox \
    dws <command> --yes

# 凭证过期后重新导出更新
dws auth export --base64 -o /tmp/dws-auth.b64
```

**核心要点**：
1. Docker 容器 Linux 默认走文件 DEK，不绑定 MAC，不需要额外配置
2. `dws auth export` 打包加密凭证 → `dws auth import` 在容器内还原
3. 导入后容器内 dws 自动管理 token 刷新，长时间运行无需外部干预
4. 宿主机 macOS 需先 `migrate-keychain --to file-dek` 或设 `DWS_DISABLE_KEYCHAIN=1`
5. 宿主机 Linux 直接可用，零额外配置

---

## 8. 与 Wecom / Lark 完整对比

| 维度 | Wecom-cli | Lark-cli | Dingtalk-workspace-cli |
|------|-----------|----------|------------------------|
| 沙箱"首次授权→解密→复用" | ✅ **已验证** | ✅ **完全支持** | ✅ **完全支持** |
| Linux / Docker 加密模式 | 文件密钥 | 文件密钥 | 文件 DEK |
| 密钥文件 | `.encryption_key` (Base64) | `master.key` (32B) | `dek` (32B) |
| 密文文件 | `credentials.enc` | `*.enc` | `auth-token.enc` |
| 解密格式 | nonce(12)+cipher+tag(16) | nonce(12)+cipher+tag(16) | nonce(12)+cipher+tag(16) |
| Docker 容器兼容 | ✅ | ✅ | ✅（最佳，官方 export/import） |
| 跨机解密 | ✅ 直接复制 | ✅ 直接复制 | ✅ 复制 dek+enc 或 export |
| 逆向解密复杂度 | ⭐ | ⭐ | ⭐ |
| 官方迁移工具 | ❌ 无 | ❌ 无 | ✅ `dws auth export/import` |
| --token / env 注入 | ❌ | ✅ `LARKSUITE_CLI_USER_ACCESS_TOKEN` | ✅ `--token` flag（hidden） |
| Docker 沙箱友好度 | ⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐（最佳） |

---

## 9. 关键代码位置

| 模块 | 路径 | 说明 |
|------|------|------|
| 加密核心 | `internal/security/crypto.go` | PBKDF2(600k) + AES-256-GCM |
| MAC 指纹 | `internal/security/fingerprint.go` | 物理 MAC → 加密密码（Docker 不涉及） |
| 文件 DEK | `internal/keychain/file_dek.go` | Linux 和 macOS 降级路径的随机密钥 |
| Linux keychain | `internal/keychain/keychain_linux.go` | Docker 容器实际走的路径 |
| macOS keychain | `internal/keychain/keychain_darwin.go` | macOS Keychain + 文件降级 |
| Secure 存储 | `internal/auth/secure_store.go` | MAC 绑定 `.data` 文件（Docker 不涉及） |
| 便携包 | `internal/auth/portable_store.go` | `dws auth export/import` 实现 |
| Keychain 存储 | `internal/auth/keychain_store.go` | 加密 token 存储（身份/组织/全局） |
| Token 管理 | `internal/auth/token.go` | SaveTokenData / LoadTokenData |
| Token 管理器 | `internal/app/access_token_resolve.go` | TokenManager 缓存层 |
| --token flag | `internal/app/flags.go` | hidden flag 定义 |
| auth 命令 | `internal/app/auth_command.go` | auth export/import CLI 入口 |
| StorageDir env | `internal/keychain/` | `DWS_KEYCHAIN_DIR` 环境变量控制 keychain 路径 |

---

## 10. 结论

**DingTalk DWS 完全支持类似 Wecom 的"沙箱内置 + 首次授权 + 解密复用"模式**，而且比 Wecom 多了官方 `dws auth export/import` 工具，实现门槛更低。

**Docker 场景尤其适合**，因为：
1. Linux 上默认就是文件 DEK 模式，不绑定 MAC，零额外配置
2. `dws auth export/import` 提供了官方的宿主机↔容器凭证传递通道
3. 导入后 dws 自动管理 token 刷新，长时间运行无需外部干预
4. 三种注入方式适配不同场景（export/import、逆向解密、--token）

| 方案 | 一句话总结 | 推荐场景 |
|------|-----------|---------|
| **A: export/import** | 一行命令迁移完整凭证 | 容器内预装 dws，长周期运行 |
| **B: 逆向解密 DEK** | 类似 wecom-decrypt.js 做法 | 容器无 dws 二进制，需手动读凭证 |
| **C: --token 注入** | 外部维护 access_token | 短会话，每次启动由外部注入 |

这与 wecom 模式本质相同，但利用了 dws 官方工具链，更加稳健。
