FROM python:3.12-slim
WORKDIR /app
RUN apt-get update && apt-get install -y libgomp1 && rm -rf /var/lib/apt/lists/*
COPY ai_services/forecast-service/pyproject.toml ./
RUN pip install --default-timeout=1000 --no-cache-dir .
COPY ai_services/forecast-service/app ./app
COPY ["Ai miroservices/modeling/v8_controlled_synthetic_validation/pipeline", "/opt/optiwms/v8/pipeline"]
COPY ["Ai miroservices/modeling/v8_controlled_synthetic_validation/outputs", "/opt/optiwms/v8/outputs"]
COPY scripts/load_project_operational_simulation.py /opt/optiwms/scripts/load_project_operational_simulation.py
COPY scripts/project_ops_catalog.py /opt/optiwms/scripts/project_ops_catalog.py
ENV V8_FORECAST_ROOT=/opt/optiwms/v8
ENV OPTIWMS_V8_OUTPUTS_DIR=/opt/optiwms/v8/outputs
ENV OPTIWMS_REPOSITORY_ROOT=/opt/optiwms
ENV PYTHONPATH=/opt/optiwms/v8
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${SERVICE_PORT:-8091}"]
