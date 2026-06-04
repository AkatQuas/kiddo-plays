FROM python:3.10-slim

# 安装依赖
RUN apt-get update && apt-get install -y --no-install-recommends gcc g++

# 配置 pip 全局使用 BFSU 北外镜像源
RUN pip config set global.index-url https://mirrors.bfsu.edu.cn/pypi/web/simple

# 安装 voxcpm
RUN pip install voxcpm

# 全局HF国内镜像，下载提速、免翻墙
ENV HF_ENDPOINT=https://hf-mirror.com

WORKDIR /app

# 入口改成 bash
ENTRYPOINT ["/bin/bash"]

