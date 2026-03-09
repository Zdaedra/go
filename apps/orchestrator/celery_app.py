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
def start_crawl(site_id: int, base_url: str, game_mode: bool = False):
    """
    This task will be picked up by the crawler-worker
    which connects to the same Redis instance.
    """
    pass

# Go Worker Configuration (different Redis DB)
GO_REDIS_URL = os.environ.get("GO_REDIS_URL", "redis://localhost:6379/1")

go_celery_app = Celery(
    "go_worker_tasks",
    broker=GO_REDIS_URL,
    backend=GO_REDIS_URL
)

go_celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
)

@go_celery_app.task(name="tasks.analyze_board")
def analyze_board(game_id: int, board_state: dict):
    """
    Signature for dispatching tasks to apps/go-worker/worker.py
    """
    pass
