FROM python:3.10-slim

# Install system dependencies including a basic Go engine for MVP
RUN apt-get update && apt-get install -y gnugo && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Run Celery worker by default
CMD ["celery", "-A", "worker.celery_app", "worker", "--loglevel=info"]
