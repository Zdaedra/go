import os
import jwt
import requests
import datetime
import logging
from celery import Celery
from database import SessionLocal, Job
from minio_utils import get_presigned_get_url, get_presigned_put_url

REDIS_URL = os.getenv("REDIS_URL", "redis://redis:6379/0")
VAST_API_URL = os.getenv("VAST_API_URL", "http://142.170.89.112:15981") # New Vast IP using external port
PUBLIC_API_BASE_URL = os.getenv("NEXT_PUBLIC_API_BASE_URL", "http://localhost")
JWT_SECRET = os.getenv("SECRET_KEY", "change_me_very_long_random")

celery_app = Celery("go_lesson", broker=REDIS_URL, backend=REDIS_URL)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
)

def generate_callback_token(job_id: str):
    payload = {
        "job_id": job_id,
        "exp": datetime.datetime.utcnow() + datetime.timedelta(hours=2)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm="HS256")

@celery_app.task(bind=True, max_retries=3)
def analyze_game_task(self, job_id: str, game_id: str, sgf_content: str):
    """
    Orchestrator task:
    1. Generate presigned URLs for input and output.
    2. Generate callback token.
    3. Send 'compute ticket' to Vast node API.
    """
    db = SessionLocal()
    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        db.close()
        return

    def update_progress(msg, prog):
        job.message = msg
        job.progress = prog
        db.commit()

    try:
        update_progress("Dispatching job to compute node...", 5)
        
        callback_token = generate_callback_token(job_id)
        
        input_sgf_key = f"sgf/{game_id}.sgf"
        input_url = get_presigned_get_url(input_sgf_key)
        
        storyboard_key = f"lessons/{game_id}/storyboard.json"
        storyboard_put_url = get_presigned_put_url(storyboard_key)
        
        ticket = {
            "job_id": job_id,
            "game_id": game_id,
            "input_sgf_url": input_url,
            "storyboard_put_url": storyboard_put_url,
            "callback_base_url": PUBLIC_API_BASE_URL,
            "callback_token": callback_token
        }
        
        # Send compute ticket to Vast
        response = requests.post(f"{VAST_API_URL}/v1/run", json=ticket, timeout=30)
        response.raise_for_status()
        
        update_progress("Sent to compute node. Waiting for callbacks...", 10)
        
    except requests.RequestException as e:
        job.status = "error"
        job.message = f"Failed to reach compute node: {str(e)}"
        db.commit()
        # Retry the task
        raise self.retry(exc=e, countdown=60)
    except Exception as e:
        job.status = "error"
        job.message = f"Failed to dispatch: {str(e)}"
        db.commit()
    finally:
        db.close()
