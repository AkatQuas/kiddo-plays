#!/bin/bash

ARCH=`python -c "import torch;print(torch.cuda.get_device_properties(device='cuda').major)"`

if [ "$ARCH" -ge 8 ]; then
  export VLLM_USE_V1=1
else
  export VLLM_USE_V1=0
fi

echo "ARCH: $ARCH"
echo "VLLM_USE_V1: $VLLM_USE_V1"

INPUT_PATH=${INPUT_PATH:-./models/CosyVoice2-0_5B}

PORT=${PORT:-34012}

SERVER_JOB="python api.py
--port $PORT
--model_name_or_path $INPUT_PATH"

echo "executing command: $SERVER_JOB..."
$SERVER_JOB
