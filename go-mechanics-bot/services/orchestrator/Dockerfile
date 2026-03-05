FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && apt-get install -y libpq-dev gcc && rm -rf /var/lib/apt/lists/*

COPY services/orchestrator/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# The application code expects the scripts/ folder to exist because of sys.path imports
COPY services/orchestrator/app/ ./services/orchestrator/app/
COPY scripts/ ./scripts/

CMD ["uvicorn", "services.orchestrator.app.api:app", "--host", "0.0.0.0", "--port", "8080"]
