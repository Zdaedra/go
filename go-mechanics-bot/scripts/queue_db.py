import redis
import json
import os
import uuid

REDIS_URL = os.environ.get('REDIS_URL', 'redis://localhost:6379/0')

try:
    redis_client = redis.from_url(REDIS_URL, decode_responses=True)
except Exception as e:
    print(f"Warning: Could not connect to redis at {REDIS_URL}. Error: {e}")
    redis_client = None

def push_job(queue_name: str, payload: dict) -> str:
    if not redis_client:
        raise Exception("Redis not available")
    
    job_id = str(uuid.uuid4())
    job_data = {
        "job_id": job_id,
        "payload": payload,
        "status": "queued"
    }
    # Push to list
    redis_client.lpush(f"queue:{queue_name}", json.dumps(job_data))
    # Also save state to a hash for quick lookup
    redis_client.hset("jobs:state", job_id, json.dumps(job_data))
    return job_id

def pop_job(queue_name: str, worker_id: str) -> dict:
    if not redis_client:
        raise Exception("Redis not available")
    
    # RPOP (or BRPOP if blocking) from queue
    job_str = redis_client.rpop(f"queue:{queue_name}")
    if not job_str:
        return None
        
    job_data = json.loads(job_str)
    job_id = job_data["job_id"]
    job_data["status"] = "processing"
    job_data["worker_id"] = worker_id
    
    redis_client.hset("jobs:state", job_id, json.dumps(job_data))
    return job_data

def complete_job(job_id: str, result: dict):
    if not redis_client:
        return
    job_str = redis_client.hget("jobs:state", job_id)
    if job_str:
        job_data = json.loads(job_str)
        job_data["status"] = "completed"
        job_data["result"] = result
        redis_client.hset("jobs:state", job_id, json.dumps(job_data))
