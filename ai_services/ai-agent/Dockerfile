FROM python:3.12-slim

# Install system compilation dependencies for ChromaDB/hnswlib
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    g++ \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt ./
RUN pip install --default-timeout=1000 --no-cache-dir -r requirements.txt

COPY . ./

EXPOSE 8094
CMD ["sh", "-c", "uvicorn api:app --host 0.0.0.0 --port ${SERVICE_PORT:-8094}"]
