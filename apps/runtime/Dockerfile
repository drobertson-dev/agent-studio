FROM python:3.13-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV PORT=8000
ENV WORKSPACE_ROOT=/workspace

RUN apt-get update && apt-get install -y --no-install-recommends \
    bash \
    curl \
    git \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY pyproject.toml README.md ./
COPY src ./src

RUN mkdir -p /workspace && pip install --no-cache-dir -e .

EXPOSE 8000

CMD ["uvicorn", "agent_studio.server:app", "--host", "0.0.0.0", "--port", "8000"]
