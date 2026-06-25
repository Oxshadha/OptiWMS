FROM python:3.10-slim

RUN apt-get update \
 && apt-get install -y --no-install-recommends libgomp1 curl \
 && rm -rf /var/lib/apt/lists/*

# Fresh install — do NOT use ghcr.io/mlflow/mlflow (broken wrapt/requests on ARM)
RUN pip install --no-cache-dir "mlflow==2.16.0" \
 && python -c "import mlflow; print('MLflow ready:', mlflow.__version__)"

EXPOSE 5000
