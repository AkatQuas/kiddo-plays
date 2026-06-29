FROM python:3.12-slim

WORKDIR /app


RUN sed -i 's/deb.debian.org/mirrors.bfsu.edu.cn/g' /etc/apt/sources.list.d/debian.sources \
    && sed -i 's/security.debian.org/mirrors.bfsu.edu.cn/g' /etc/apt/sources.list.d/debian.sources \
    && apt-get update -qq \
    && apt-get install -y --no-install-recommends -qq \
        libespeak-ng1 \
        -o Dpkg::Options::="--force-confdef" \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt -i https://mirrors.bfsu.edu.cn/pypi/web/simple/

COPY app.py .

ENV TTS_SAMPLE_RATE=24000
ENV HF_HOME=/models
ENV PIPER_MODEL_FILE=zh/zh_CN/huayan/medium/zh_CN-huayan-medium.onnx

EXPOSE 8002

CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8002"]
