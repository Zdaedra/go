import os
from celery import Celery

REDIS_URL = os.environ.get("REDIS_URL", "redis://localhost:6379/0")

celery_app = Celery(
    "orchestrator_tasks",
    broker=REDIS_URL,
    backend=REDIS_URL
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
)

@celery_app.task(name="tasks.start_crawl")
def start_crawl(site_id: int, base_url: str):
    """
    This task will be picked up by the crawler-worker
    which connects to the same Redis instance.
    """
    # In reality, this function definition is just the signature used by Orchestrator to push to the queue.
    # The actual execution happens inside crawler-worker.
    pass
