import os
from celery import Celery
from crawler import SiteCrawler

REDIS_URL = os.environ.get("REDIS_URL", "redis://localhost:6379/1")

celery_app = Celery(
    "crawler_tasks",
    broker=REDIS_URL,
    backend=REDIS_URL,
    include=['worker']
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
)

@celery_app.task(name="tasks.start_crawl")
def execute_crawl(site_id: int, base_url: str):
    """
    Subscribes to the tasks.start_crawl queue and actually launches Playwright.
    """
    crawler = SiteCrawler(site_id=site_id, base_url=base_url)
    crawler.run()
    return {"status": "success", "site_id": site_id}
