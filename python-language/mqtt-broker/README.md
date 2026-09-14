# MQTT + Protobuf Demo (mqtt-broker)

一个用于演示 **MQTT 发布/订阅（Pub/Sub）模式在 Protobuf 数据格式下传输** 的最小可运行示例：
发布者在宿主机用 Protobuf 序列化模拟传感器数据，发布到 Docker 容器中的 Mosquitto Broker，订阅者订阅该主题并反序列化打印 —— 全程无需任何硬件。

---

## 1. 项目简介

> 一个纯软件的 MQTT + Protobuf 发布/订阅 demo：**Docker 里跑 Mosquitto Broker，宿主机上用 `uv` 跑 Publisher 和 Subscriber**，传感器读数以 Protobuf 二进制格式在主题上流动。

## 2. 架构图

```text
                       +------------------------------------------------------------+
                       |                        宿主机 (Host)                        |
                       |                                                            |
                       |   +---------------------+      +-------------------+       |
                       |   |    publisher.py     |      |   subscriber.py   |       |
                       |   |   (uv run) [pub]    |      |   (uv run) [sub]  |       |
                       |   |  生成 SensorReading  |      |  订阅 topic        |       |
                       |   |  Serialize 成二进制  |      |  反序列化并打印      |       |
                       |   +---------+----------+       +-------------------+       |
                       |             |  publish                     ^               |
                       |             v                            |                 |
                       |        topic: sensor/device-001/data     |  topic match    |
                       +-------------+----------- MQTT :1883 -----+-----------------+
                                     |
                            host 1883  <====>  container 1883
                                     |
                        +------------v------------+
                        |        Docker 容器       |
                        |   eclipse-mosquitto:2   |
                        |        (Broker)         |
                        +-------------------------+
```

- **Publisher / Subscriber 在宿主机**：通过 `uv run` 启动，TCP 连到 `localhost:1883`。
- **Mosquitto Broker 在 Docker 容器**：`docker-compose.yml` 把容器的 `1883` 映射到宿主机的 `1883`。
- **消息流向**：`Publisher --序列化--> Broker --转发--> Subscriber --反序列化--> 打印`。

## 3. 运行流程图

```text
┌───────────────────────────────────────────────────────────────────────────┐
│                         完整运行流程                                        │
│                                                                           │
│ ① 环境准备        uv  +  Docker  +  Docker Compose + Python ≥ 3.11        │
│ ② 安装依赖        uv sync                                                 │
│ ③ 生成 Protobuf   bash scripts/generate_proto.sh                         │
│                     └→ 由 proto/sensor.proto 生成 generated/sensor_pb2.py │
│ 4 启动 Broker     docker compose up -d                                    │
│                     └→ Mosquitto 在容器内监听 1883,映射到宿主机              │
│ ⑤ 先启动订阅者    uv run python -m src.subscriber   (先订阅)                │
│                     └→ 连上 Broker 并订阅 sensor/+/data                    │
│ ⑥ 另开终端启动发布者 uv run python -m src.publisher (后发布)                 │
│                     └→ 每 1s 生成 SensorReading → Serialize → pub QoS1     │
│ ⑦ 接收与打印      Broker 转发 → subscriber 反序列化 → 打印结构化字段           │
│ 8 停止清理        docker compose down                                      │
└───────────────────────────────────────────────────────────────────────────┘
```

## 4. 环境准备

| 依赖           | 版本要求                            | 说明                                                                 |
| -------------- | ----------------------------------- | -------------------------------------------------------------------- |
| Docker         | 任意支持 `docker compose` v2 的版本 | 用于运行 Mosquitto 容器（本仓库在 OrbStack / Docker Desktop 上验证） |
| Docker Compose | v2                                  | `docker compose` 子命令即可                                          |
| uv             | ≥ 0.1                               | 管理 Python 版本 + 依赖 + 虚拟环境                                   |
| Python         | 3.11 或以上                         | 宿主机客户端运行时（由 uv 自动选择）                                 |

> 说明：宿主机只需要 Docker 引擎和 `uv`，**无需在宿主机安装任何 MQTT Broker**。

## 5. 运行步骤

在项目根目录（本文件所在目录）执行。全部命令按顺序：

```bash
# 1) 安装依赖（在 .venv 中，生成 uv.lock）
uv sync

# 2) 生成 Protobuf 代码（proto/sensor.proto → generated/sensor_pb2.py）
#    已生成的文件随仓库提供，仅当修改 .proto 后才需重跑
bash scripts/generate_proto.sh

# 3) 启动 MQTT Broker（Docker 容器）
docker compose up -d

# 4) 启动订阅者（终端 A）—— 先订阅
uv run python -m src.subscriber

# 5) 另开一个终端启动发布者 —— 后发布
uv run python -m src.publisher

# 6) 停止并清理 Broker（回到宿主机零残留状态）
docker compose down
```

运行说明：

- **必须先启动订阅者、再启动发布者**，这样才能看到订阅者实时打印（MQTT 默认不保留消息，先订阅后发布才能收到）。
- 发布者每 1 秒发一条，按 `Ctrl+C` 退出。
- 若想长时间演示，让订阅者与发布者各占一个终端即可。

## 6. 停止并清理

`docker compose down` 会停止并移除容器与网络。

```bash
docker compose down
docker ps                        # 不应再有 mqtt-broker-demo 容器
pgrep -fl mosquitto              # 宿主机上不应有 mosquitto 进程（应为空）
```

> 注：`restart: unless-stopped` 只会让容器在 Docker 引擎运行时自启，`docker compose down` 会显式停掉它，不再自启。

## 7. 预期输出

**订阅者终端**（`uv run python -m src.subscriber`）：

```text
[sub] Listening on 'sensor/+/data' (Ctrl+C to stop)
[sub] Connected to broker; subscribing to 'sensor/+/data'

[sub] Got 30 raw bytes on topic 'sensor/device-001/data' -> 0a0a6465766963652d30303110cbaf9dd5061d6666ca4125333385422863
[sub] Decoded: device=device-001 ts=1789351883 (10:11:23) temp=25.3°C hum=66.6% bat=99%

[sub] Got 30 raw bytes on topic 'sensor/device-001/data' -> 0a0a6465766963652d30303110ccaf9dd5061d9a99ad41259a9987422863
[sub] Decoded: device=device-001 ts=1789351884 (10:11:24) temp=21.7°C hum=67.8% bat=99%

[sub] Got 30 raw bytes on topic 'sensor/device-001/data' -> 0a0a6465766963652d30303110cdaf9dd5061dcdccc0412533335d422864
[sub] Decoded: device=device-001 ts=1789351885 (10:11:25) temp=24.1°C hum=55.3% bat=100%
```

第一行是**收到的原始二进制**（hex），第二行是**反序列化后的结构化字段** —— 直观体现“二进制 → 结构化”的对比。

**发布者终端**（`uv run python -m src.publisher`）：

```text
[pub] Connected to broker at localhost:1883
[pub] Publishing to topic 'sensor/device-001/data' every 1.0s (Ctrl+C to stop)
[pub] Serialized 30 bytes: 0a0a6465766963652d30303110c5669dd5061d666d6ae412533338422863
Published: device-001 temp=25.3 hum=66.5 bat=99
[pub] Serialized 30 bytes: 0a0a6465766963652d30303110c6669dd5061d9a99ab4125987b42863
Published: device-001 temp=21.7 hum=67.9 bat=99
```

## 8. 原理说明

### 8.1 为什么 MQTT 能承载 Protobuf

- MQTT 的 **消息载荷（payload）本质就是任意字节流**（byte array），它只关心“主题匹配 + 投递质量（QoS）”，对载荷的内容和格式完全无感知。
- Protobuf 负责把结构化对象序列化/反序列化成紧凑的二进制。所以两者天然互补：**MQTT 管传输（通道），Protobuf 管编码（内容）**。
- 流程就是一条流水线：`对象 --Protobuf--> bytes --MQTT(Pub)--> Broker --MQTT(Sub)--> bytes --Protobuf--> 对象`。订阅方接收到的就是发布方 `Serialize` 出来的同一段字节。

### 8.2 优点 / 缺点

**优点**

- **体积小**：Protobuf 采用变长编码 (varint) 与紧凑字段结构，比 JSON/XML 小得多（本例一条读数约 30 字节，等价的 JSON 通常过百字节），省流量、省带宽，对 IoT 尤其关键。
- **性能好**：无需手写解析，`sensor.proto` 一处定义，可生成 Python / C++ / Go / Java 等多语言代码，跨语言契约统一。
- **有 Schema**：字段类型、编号由 `.proto` 约束，层次性强，适合复杂嵌套结构，可向后兼容演进。

**缺点**

- **不可读 / 难调试**：线上中间是二进制，无法像 JSON 那样肉眼直接解读（订阅者直接打印 hex 只能看到乱码）。
- **调试必需 `.proto`**：要解码必须先有对应的 `.proto` 文件 + 代码，缺少协议定义就无法解析；工具也不如文本格式友好。
- **编码成本**：需要编译生成代码，对新手有一定门槛；生成文件通常需提交或纳入构建。

**我们的 demo 正是演示了这些性质**：hex 打印不可读，但一次 `ParseFromString` 就还原出结构化字段。

### 8.3 为什么 Broker 用 Docker、客户端在宿主机

- **隔离性（隔离）**：Broker 是有固定服务的状态组件。把它封装进容器，与宿主机其余系统隔离，不影响宿主机的端口占用与进程列表；`docker compose down` 之后宿主机**零残留**，不会留下任何后台服务。
- **可复现性**：`eclipse-mosquitto:2` + 一份 `mosquitto.conf` 就能在任何机器上得到完全相同的 Broker 行为，避免“我机器上能跑”的差异。
- **易于切换**：换用 EMQX / HiveMQ 等只需改 `docker-compose.yml` 的镜像，客户端代码与运行方式完全不变。
- 客户端放在宿主机运行，是为了直观展示“任何普通 MQTT 客户端只需要有网络和 IP:端口（`localhost:1883`）就能接入 broker”，无需任何 broker 依赖。

## 9. 常见问题 (FAQ)

| 问题                                                  | 排查 / 解决                                                                                                                                                           |
| ----------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **端口 1883 被占用**                                  | 改 `docker-compose.yml` 端口映射（如 `1884:1883`），并同步改 `src/config.py` 的 `MQTT_PORT`。若之前有容器占用：`docker compose down`；查占用：`lsof -nP -iTCP:1883`。 |
| **Docker 未启动**                                     | `docker info` 会报错。先启动 Docker 引擎（OrbStack / Docker Desktop / 相应守护进程），再 `docker compose up -d`。                                                     |
| **`docker compose` 命令不存在 / 用 `docker-compose`** | 安装 Compose v2，或把命令换成 `docker-compose`（v1），v1/v2 语法大同兼容。                                                                                            |
| **可 runtime 提示 `sensor_pb2` 模块找不到**           | 没有运行生成脚本。执行 `bash scripts/generate_proto.sh`（先 `uv sync`），确认仓库根目录存在 `generated/sensor_pb2.py`。                                               |
| **连不上 Broker / `Connection FAILED`**               | ① 确认容器活：`docker compose ps`；② 确认映射端口：`docker compose logs mosquitto` 应显示监听 1883；③ 确认 Config 的 host/port 匹配。                                 |
| **订阅者收到不消息**                                  | MQTT 默认不保留消息，**需订阅者先启动、发布者后启动**；也可在发布者 `client.publish(..., retain=True)` 临时测试。                                                     |
| **发布者/订阅者日志被缓冲或空**                       | 用 `PYTHONUNBUFFERED=1 uv run python -m src.publisher` 禁用缓冲，或等进程结束后查看。                                                                                 |
| **Mosquitto 拒绝匿名连接**                            | `mosquitto.conf` 已显式 `allow_anonymous true`。若曾改过认证方案，请在 `src/config.py` 填入 `MQTT_USERNAME` / `MQTT_PASSWORD`，参考中注释。                           |

## 生产化建议

- 关闭匿名：在 `mosquitto.conf` 设置 `allow_anonymous false` + `password_file` + `persist true`（见该文件内注释），并在 `src/config.py` 配置账号。
- 使用 TLS：为 8883 端口配置证书。
- 替换 Broker：改 `docker-compose.yml` 镜像即可（如 `emqx/emqx:latest`）。

> 本 demo 的 `allow_anonymous true` 仅为本地演示方便，生产环境务必启用认证。
