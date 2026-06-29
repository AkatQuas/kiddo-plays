FROM python:3.12-slim

WORKDIR /app

RUN sed -i 's/deb.debian.org/mirrors.bfsu.edu.cn/g' /etc/apt/sources.list.d/debian.sources \
    && sed -i 's/security.debian.org/mirrors.bfsu.edu.cn/g' /etc/apt/sources.list.d/debian.sources \
    && apt-get update -qq \
    && apt-get install -y --no-install-recommends -qq \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt -i https://mirrors.bfsu.edu.cn/pypi/web/simple/

COPY app.py .

ENV WHISPER_MODEL=Systran/faster-whisper-base
ENV WHISPER_DEVICE=cpu
ENV WHISPER_COMPUTE_TYPE=int8
ENV HF_HOME=/models

EXPOSE 8001

CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8001"]
