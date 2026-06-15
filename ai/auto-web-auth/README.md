# auto-web-auth

内网（`auth.google.net`）自动认证工具。定时检测外网是否可达，不可达时自动提交认证，避免频繁掉线后需手动登录。

## 原理

1. 访问 `https://cn.bing.com` 判断当前是否已联网
2. 若可访问 → 跳过，不做任何事
3. 若不可访问 → 向认证页 POST 用户名、密码、本机 IP
4. 根据响应内容判断成功（`验证通过，正在登录`）或失败（`授权失败`）

## 文件说明

| 文件                                   | 说明                                 |
| -------------------------------------- | ------------------------------------ |
| `auth.sh`                              | 主脚本                               |
| `auth.env.example`                     | 配置模板                             |
| `auth.env`                             | 实际凭据（需自行创建，已 gitignore） |
| `launchd/com.user.auto-web-auth.plist` | launchd 任务模板                     |
| `install-launchd.sh`                   | 安装定时任务                         |
| `uninstall-launchd.sh`                 | 卸载定时任务                         |
| `test-auth.http`                       | 原始 curl 请求参考                   |
| `auth-good.txt` / `auth-bad.txt`       | 成功 / 失败响应示例                  |

## 快速开始

### 1. 配置凭据

```bash
cp auth.env.example auth.env
```

编辑 `auth.env`：

```bash
AUTH_USERNAME=你的用户名
AUTH_PASSWORD=你的密码

# 可选：手动指定 IP，留空则自动获取默认路由网卡 IP
# AUTH_USER_IP=10.1.109.141
```

也可不建 `auth.env`，直接导出环境变量：

```bash
export AUTH_USERNAME=你的用户名
export AUTH_PASSWORD=你的密码
```

### 2. 手动测试

```bash
chmod +x auth.sh
./auth.sh
tail -f auth.log
```

### 3. 安装 launchd 定时任务

```bash
./install-launchd.sh
```

默认每 **100 分钟**检测一次（可在 `launchd/com.user.auto-web-auth.plist` 中修改 `StartInterval`，单位：秒）。安装后登录即自动启动。

## 环境变量

| 变量              | 必填 | 默认值                     | 说明                              |
| ----------------- | ---- | -------------------------- | --------------------------------- |
| `AUTH_USERNAME`   | 是   | —                          | 认证用户名                        |
| `AUTH_PASSWORD`   | 是   | —                          | 认证密码                          |
| `AUTH_USER_IP`    | 否   | 自动获取                   | 本机 IP（默认路由网卡，如 `en0`） |
| `AUTH_URL`        | 否   | `https://auth.google.net/` | 认证地址                          |
| `CHECK_URL`       | 否   | `https://cn.bing.com`      | 连通性检测地址                    |
| `CONNECT_TIMEOUT` | 否   | `5`                        | curl 超时（秒）                   |
| `LOG_FILE`        | 否   | `<项目目录>/auth.log`      | 业务日志路径                      |
| `AUTH_ENV_FILE`   | 否   | `<项目目录>/auth.env`      | 配置文件路径                      |

## launchd 常用命令

```bash
# 立即执行一次
launchctl kickstart gui/$(id -u)/com.user.auto-web-auth

# 查看任务状态
launchctl print gui/$(id -u)/com.user.auto-web-auth

# 卸载
./uninstall-launchd.sh
```

日志位置：

- `auth.log` — 脚本业务日志（检测、认证结果）
- `launchd.out.log` / `launchd.err.log` — launchd 标准输出 / 错误

## 安装后移动目录会怎样？

**会有问题。** `install-launchd.sh` 安装时会把**当时的绝对路径**写入 `~/Library/LaunchAgents/com.user.auto-web-auth.plist`，包括：

- `auth.sh` 脚本路径
- `auth.env` 配置文件路径
- `launchd.out.log` / `launchd.err.log` 日志路径

移动项目目录后，launchd 仍指向旧路径，典型表现：

| 现象                     | 原因                       |
| ------------------------ | -------------------------- |
| 定时任务不再执行或报错   | `auth.sh` 在旧路径已不存在 |
| 认证失败、提示未设置凭据 | `auth.env` 找不到          |
| 日志不再更新或写到旧目录 | 日志路径仍指向旧位置       |

`auth.sh` 内部虽用相对路径解析配置，但 **launchd 调用的是安装时写死的绝对路径**，移动目录后不会自动跟随。

### 正确做法

移动目录后，在新位置重新安装：

```bash
cd /新/路径/auto-web-auth
./install-launchd.sh
```

或先卸载再移动再安装：

```bash
./uninstall-launchd.sh
# 移动目录
cd /新/路径/auto-web-auth
./install-launchd.sh
```

> **建议**：选定固定安装路径（如 `~/bin/auto-web-auth`），避免随意移动。若 `auth.env` 里设置了 `LOG_FILE` 等绝对路径，移动后也需一并更新。

## 调整检测频率

编辑 `launchd/com.user.auto-web-auth.plist` 中的 `StartInterval`（秒），然后重新执行 `./install-launchd.sh` 生效。

示例：

```xml
<key>StartInterval</key>
<integer>300</integer>   <!-- 每 5 分钟 -->
```

## 故障排查

**网络正常但仍触发认证**

- 检查 `CHECK_URL` 是否在当前网络下可访问
- 适当增大 `CONNECT_TIMEOUT`

**认证失败**

- 确认 `auth.env` 中用户名、密码正确
- 查看 `auth.log` 是否有 `授权失败`
- 确认 `AUTH_USER_IP` 与当前机器实际 IP 一致（可留空自动获取）

**launchd 无反应**

```bash
launchctl print gui/$(id -u)/com.user.auto-web-auth
cat launchd.err.log
```

确认 plist 中路径与当前项目目录一致；不一致则重新 `./install-launchd.sh`。
