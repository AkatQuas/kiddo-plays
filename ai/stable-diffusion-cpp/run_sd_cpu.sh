#!/usr/bin/env bash
# 在 Ubuntu 24.04 容器中运行 sd-cli，输出到宿主机

set -euo pipefail

# ============ 可按需修改的配置 ============
# https://github.com/leejet/stable-diffusion.cpp/releases/tag/master-853-b68d586 
# unziped from `sd-master-b68d586-bin-Linux-Ubuntu-24.04-x86_64-vulkan.zip`
SD_DIR="/data/sd-cli"
MODEL_DIR="/data/models"
OUTPUT_DIR="${SD_DIR}/output"
# use ./Dockerfile to build a local image
IMAGE="sd-cli-base:latest"

# flux-2-klein-4b-Q8_0.gguf from leejet/FLUX.2-klein-4B-GGUF
DIFFUSION_MODEL="flux-2-klein-4b-Q8_0.gguf"
LLM_MODEL="Qwen3-4B-Q4_K_M.gguf"
# renamed from file "vae/diffusion_pytorch_model.safetensors" from repo black-forest-labs/FLUX.2-klein-4B 
VAE_MODEL="flux2-vae.safetensors"

CFG_SCALE="1.5"
STEPS="6"
WIDTH="1024"
HEIGHT="1024"
# =========================================

# 用法提示
if [ $# -lt 2 ]; then
  echo "用法: $0 <输出文件名> \"<prompt>\" [额外 sd-cli 参数...]"
  echo "示例: $0 cat.png \"a lovely cat\""
  echo "      $0 cat_hd.png \"a lovely cat\" -W 1024 -H 1024 --steps 8"
  exit 1
fi

OUTPUT_NAME="$1"
PROMPT="$2"
shift 2
EXTRA_ARGS=("$@")

# 确保输出目录存在
mkdir -p "${OUTPUT_DIR}"

# 运行容器
docker run --rm -it \
  -v "${SD_DIR}":/sd \
  -v "${MODEL_DIR}":/models \
  -w /sd \
  "${IMAGE}" \
  bash -c "./sd-cli \
    --diffusion-model /models/${DIFFUSION_MODEL} \
    --llm /models/${LLM_MODEL} \
    --vae /models/${VAE_MODEL} \
    -p \"${PROMPT}\" \
    --cfg-scale ${CFG_SCALE} \
    --steps ${STEPS} \
    -W ${WIDTH} -H ${HEIGHT} \
    ${EXTRA_ARGS[*]} \
    --offload-to-cpu \
    -o /sd/output/${OUTPUT_NAME}"

