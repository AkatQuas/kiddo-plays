#!/usr/bin/env bash
# 直接使用现成的镜像运行

set -euo pipefail

# ============ 可按需修改的配置 ============
# host folder, just for output folder
SD_DIR="/data/sd-cli"
MODEL_DIR="/data/models"
OUTPUT_DIR="${SD_DIR}/output"
# https://github.com/leejet/stable-diffusion.cpp/pkgs/container/stable-diffusion.cpp
IMAGE="stable-diffusion.cpp:master-cuda"

# flux-2-klein-9b-Q8_0.gguf from leejet/FLUX.2-klein-9B-GGUF
DIFFUSION_MODEL="flux-2-klein-9b-Q8_0.gguf"
# Qwen3-8B-Q4_K_M.gguf from Qwen/Qwen3-8B-GGUF
# or choose an uncensored model
LLM_MODEL="Qwen3-8B-Q4_K_M.gguf"
# renamed from file "vae/diffusion_pytorch_model.safetensors" from repo black-forest-labs/FLUX.2-klein-4B
VAE_MODEL="flux2-vae.safetensors"

# NSFW Lora
# AntiLeecher/Flux-Klein-NSFW-Lora, rename it with correct usage

CFG_SCALE="1.5"
STEPS="8"
WIDTH="1024"
HEIGHT="1024"
# =========================================

# 用法提示
if [ $# -lt 1 ]; then
  echo "用法: $0 <输出文件名> \"<prompt>\" [额外 sd-cli 参数...]"
  echo "示例: $0 cat.png "
  echo "      $0 cat_hd.png  -W 1024 -H 1024 --steps 8"
  exit 1
fi

OUTPUT_NAME="$1"
PROMPT="A beautiful adult Japanese woman with long flowing black hair stands on a sunlit green lawn, wearing an elegant white lace wedding dress with a deep V-neckline and sheer lace sleeves. The dress features a deep cleavage cutout. Bright natural sunlight illuminates the delicate lace texture, a sheer veil gently blowing in the breeze, soft shadows on the grass, fresh outdoor atmosphere, cinematic lighting, high detail, realistic style, 8k, masterpiece."
shift 1
EXTRA_ARGS=("$@")

# 确保输出目录存在
mkdir -p "${OUTPUT_DIR}"

# 运行容器
docker run --rm -it \
  --gpus all \
  -v "${SD_DIR}":/sd \
  -v "${MODEL_DIR}":/models \
  -w /sd \
  "${IMAGE}" \
  --diffusion-model /models/${DIFFUSION_MODEL} \
  --llm /models/${LLM_MODEL} \
  --vae /models/${VAE_MODEL} \
  --lora-model-dir /models/lora \
  -p "${PROMPT}<lora:flux-klein-lora:1>" \
  --cfg-scale ${CFG_SCALE} \
  --steps ${STEPS} \
  -W ${WIDTH} -H ${HEIGHT} \
  "${EXTRA_ARGS[*]}" \
  -o "/sd/output/${OUTPUT_NAME}"
