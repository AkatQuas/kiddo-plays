FROM python:3.12-slim-bookworm

WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends libstdc++6 \
    && rm -rf /var/lib/apt/lists/*

COPY pyproject.toml README.md ./
COPY data_analysis ./data_analysis

RUN pip install --no-cache-dir .

EXPOSE 8000
ENV DATA_ANALYSIS_REQUIRE_AUTH=false

CMD ["uvicorn", "data_analysis.main:app", "--host", "0.0.0.0", "--port", "8000"]