FROM python:3.11-slim

# Install system compilation dependencies for ChromaDB/hnswlib
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    g++ \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY . ./

CMD ["sh", "-c", "uvicorn api:app --host 0.0.0.0 --port ${SERVICE_PORT:-8094}"]
