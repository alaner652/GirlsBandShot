FROM pytorch/pytorch:2.7.0-cuda12.8-cudnn9-runtime

RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY pyproject.toml ./
COPY src/ ./src/

RUN pip install --no-cache-dir -e .

COPY config.yaml ./

VOLUME ["/app/videos", "/app/output"]

ENTRYPOINT ["python", "-m", "extractor.cli"]
CMD ["--help"]
