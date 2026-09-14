# Stable Diffusion (sd-cli)

通过 Docker 容器运行 [stable-diffusion.cpp](https://github.com/leejet/stable-diffusion.cpp) 的 `sd-cli` 命令行工具，在本地生成 / 输出图像。

## 概览

本目录提供了一系列脚本，用容器把 `sd-cli` 与模型 `gguf` 文件隔离运行，输出到宿主机指定目录。核心模型为 **FLUX.2-klein** 系列 + **Qwen3** 作为文本/提示词模型。

| 文件 | 用途 |
| --- | --- |
| [`run_sd_cpu.sh`](./run_sd_cpu.sh) | CPU / Vulkan 推理，使用本目录 `./Dockerfile` 构建的本地镜像 |
| [`run_sd_cuda.sh`](./run_sd_cuda.sh) | NVIDIA GPU (CUDA) 推理，使用预编译的 `master-cuda` 官方镜像 |
| [`run_sd_nsfw.sh`](./run_sd_nsfw.sh) | 在 CUDA 基础上加载 NSFW LoRA 模型 |
| [`Dockerfile`](./Dockerfile) | 最小化 Ubuntu 24.04 基础镜像（仅含 `libgomp1` 运行时库） |

## 快速开始

### 1. 准备模型文件

把以下 `.gguf` / `.safetensors` 放到宿主机模型的目录（默认 `${MODEL_DIR}`，见脚本内配置，通常为 `/data/models`）：

| 文件 | 来源 |
| --- | --- |
| `flux-2-klein-4b-Q8_0.gguf` | `leejet/FLUX.2-klein-4B-GGUF` |
| `flux-2-klein-9b-Q8_0.gguf` | `leejet/FLUX.2-klein-9B-GGUF`（NSFW 脚本使用） |
| `Qwen3-4B-Q4_K_M.gguf` | `Qwen/Qwen3-4B-GGUF` |
| `Qwen3-8B-Q4_K_M.gguf` | `Qwen/Qwen3-8B-GGUF`（NSFW 脚本使用） |
| `flux2-vae.safetensors` | 由 `black-forest-labs/FLUX.2-klein-4B` 中的 `vae/diffusion_pytorch_model.safetensors` 重命名而来 |

### 2. 选择运行方式

**CPU（先用它验证链路是否打通）**

```bash
docker build -t sd-cli-base:latest ./   # 只构建一次
./run_sd_cpu.sh cat.png "a lovely cat"
```

**NVIDIA GPU (CUDA)**

```bash
./run_sd_cuda.sh cat_hd.png "a lovely cat" -W 1024 -H 1024 --steps 8
```

## 用法

所有脚本都接受相同的参数：

```
./run_sd_cpu.sh <输出文件名> "<prompt>" [额外 sd-cli 参数...]
```

- 第一次参数是相对 `/data/sd-cli/output` 的输出文件名（自动创建目录）。
- 第二个参数是提示词 prompt（需加引号）。
- 后续参数原样透传给 `sd-cli`（如 `-W`、`--steps` 等）。

### 在脚本内可修改的配置项

每个脚本顶部的 `# ============` 区块集中了常用配置，可直接改：

- `SD_DIR` / `MODEL_DIR` / `OUTPUT_DIR` — 宿主机目录挂载
- `DIFFUSION_MODEL` / `LLM_MODEL` / `VAE_MODEL` — 使用的模型文件
- `CFG_SCALE` / `STEPS` / `WIDTH` / `HEIGHT` — 采样参数

### CPU 脚本专用

`run_sd_cpu.sh` 以本地镜像运行，并在参数里追加 `--offload-to-cpu`；CPU 推理较慢，推荐用小分辨率（默认 1024）先测试。

### NSFW 脚本

`run_sd_nsfw.sh` 内置了一个默认的成人向 prompt，并会挂载 `/models/lora` 目录、以 `<lora:flux-klein-lora:1>` 的方式启用 NSFW LoRA。使用需自备 LoRA 文件（如 `AntiLeecher/Flux-Klein-NSFW-Lora`）。

> 该脚本只要求一个参数（输出文件名），prompt 可省略，会用内置默认值。

## 相关链接

- [stable-diffusion.cpp 源码](https://github.com/leejet/stable-diffusion.cpp)
- [sd-cli 发布/镜像](https://github.com/leejet/stable-diffusion.cpp/pkgs/container/stable-diffusion.cpp)
- [模型仓库 leejet/FLUX.2-klein-4B-GGUF](https://huggingface.co/leejet/FLUX.2-klein-4B-GGUF)