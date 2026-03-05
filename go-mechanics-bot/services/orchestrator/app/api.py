from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import sys
import os
from pydantic import BaseModel
from typing import Optional

sys.path.append(os.path.join(os.path.dirname(__file__), '..', '..', '..', 'scripts'))
import loop_db
import queue_db
import s3_db

app = FastAPI(title="Go Mechanics Bot Metrics API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
def startup_event():
    # Ensure DB is created if it doesn't exist
    loop_db.init_db()

@app.get("/api/status")
def get_status():
    """
    Returns the current execution loop status and overall metrics
    so the dashboard can render it nicely.
    """
    try:
        data = loop_db.get_dashboard_data()
        return data
    except Exception as e:
        return {"error": str(e), "status": "Database Error"}

@app.post("/api/bot/start")
def start_bot():
    try:
        loop_db.set_target_state('running')
        return {"status": "success", "message": "Bot target state set to running"}
    except Exception as e:
        return {"error": str(e)}

@app.post("/api/bot/stop")
def stop_bot():
    try:
        loop_db.set_target_state('paused')
        return {"status": "success", "message": "Bot target state set to paused"}
    except Exception as e:
        return {"error": str(e)}

class JobPayload(BaseModel):
    queue: str
    payload: dict

class PopPayload(BaseModel):
    queue: str
    worker_id: str

@app.post("/api/jobs/push")
def api_push_job(data: JobPayload):
    try:
        job_id = queue_db.push_job(data.queue, data.payload)
        return {"status": "success", "job_id": job_id}
    except Exception as e:
        return {"error": str(e)}

@app.post("/api/jobs/pop")
def api_pop_job(data: PopPayload):
    try:
        job = queue_db.pop_job(data.queue, data.worker_id)
        if not job:
            return {"status": "empty", "message": "No jobs available"}
        return {"status": "success", "job": job}
    except Exception as e:
        return {"error": str(e)}

class CompletePayload(BaseModel):
    result: dict

@app.post("/api/jobs/{job_id}/complete")
def api_complete_job(job_id: str, data: CompletePayload):
    try:
        queue_db.complete_job(job_id, data.result)
        return {"status": "success"}
    except Exception as e:
        return {"error": str(e)}

class PresignedParams(BaseModel):
    object_name: str
    expiration: Optional[int] = 3600

@app.post("/api/artifacts/upload-url")
def get_upload_url(data: PresignedParams):
    url = s3_db.get_presigned_upload_url(data.object_name, data.expiration)
    if url:
        return {"status": "success", "url": url}
    return {"status": "error", "message": "Failed to generate URL"}

@app.post("/api/artifacts/download-url")
def get_download_url(data: PresignedParams):
    url = s3_db.get_presigned_download_url(data.object_name, data.expiration)
    if url:
        return {"status": "success", "url": url}
    return {"status": "error", "message": "Failed to generate URL"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8081)
