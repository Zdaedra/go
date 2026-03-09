FROM mcr.microsoft.com/playwright/python:v1.40.0-jammy

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Install Playwright browsers (already in the image, but good practice to ensure)
RUN playwright install chromium

COPY . .

# Run Celery worker listening to crawler_tasks
CMD ["celery", "-A", "worker.celery_app", "worker", "--loglevel=info"]
