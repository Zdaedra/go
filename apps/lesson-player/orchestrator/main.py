from fastapi import FastAPI, UploadFile, File, BackgroundTasks, HTTPException, Depends, Header
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import uuid
import os
import jwt
from sqlalchemy.orm import Session
from database import init_db, get_db, Game, Job, Lesson
from minio_utils import init_minio, upload_file_to_minio
from worker import analyze_game_task

app = FastAPI(title="Go Lesson MVP API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
def on_startup():
    init_db()
    init_minio()

class JobResponse(BaseModel):
    id: str
    status: str
    progress: int
    message: str

class ProgressRequest(BaseModel):
    progress: int
    message: str

class CompleteRequest(BaseModel):
    storyboard_url: str

class FailRequest(BaseModel):
    message: str

class PresignedUrlRequest(BaseModel):
    file_name: str

JWT_SECRET = os.getenv("SECRET_KEY", "change_me_very_long_random")

def verify_callback_token(job_id: str, token: str):
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
        if payload.get("job_id") != job_id:
            raise HTTPException(status_code=403, detail="Invalid token for this job")
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=403, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=403, detail="Invalid token")

@app.post("/v1/games")
async def create_game(file: UploadFile = File(...), db: Session = Depends(get_db)):
    if not file.filename.endswith(".sgf"):
        raise HTTPException(status_code=400, detail="Must be an SGF file")
    
    content = await file.read()
    
    # Generate IDs
    game_id = str(uuid.uuid4())
    job_id = str(uuid.uuid4())
    
    # Upload to Minio
    file_name = f"sgf/{game_id}.sgf"
    sgf_url = upload_file_to_minio(file_name, content, "application/x-go-sgf")
    
    # Save to DB
    game = Game(id=game_id, sgf_url=sgf_url)
    db.add(game)
    job = Job(id=job_id, game_id=game_id, status="queued", progress=0, message="Pending analysis")
    db.add(job)
    db.commit()
    
    # Trigger Celery Task
    analyze_game_task.delay(job_id, game_id, content)

    return {"game_id": game_id, "job_id": job_id}

@app.get("/v1/jobs/{job_id}", response_model=JobResponse)
async def get_job(job_id: str, db: Session = Depends(get_db)):
    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return {"id": job.id, "status": job.status, "progress": job.progress, "message": job.message}

@app.get("/v1/games/{game_id}/lesson")
async def get_lesson(game_id: str, db: Session = Depends(get_db)):
    lesson = db.query(Lesson).filter(Lesson.game_id == game_id).first()
    if not lesson:
        raise HTTPException(status_code=404, detail="Lesson not found")
    return {"storyboard_url": lesson.storyboard_url}

@app.post("/v1/jobs/{job_id}/progress")
async def job_progress(job_id: str, req: ProgressRequest, authorization: str = Header(None), db: Session = Depends(get_db)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing authorization header")
    verify_callback_token(job_id, authorization.split(" ")[1])
    
    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
        
    job.progress = req.progress
    job.message = req.message
    db.commit()
    return {"status": "ok"}

@app.post("/v1/jobs/{job_id}/complete")
async def job_complete(job_id: str, req: CompleteRequest, authorization: str = Header(None), db: Session = Depends(get_db)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing authorization header")
    verify_callback_token(job_id, authorization.split(" ")[1])
    
    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
        
    job.progress = 100
    job.status = "done"
    job.message = "Analysis complete."
    
    lesson = Lesson(id=job.game_id, game_id=job.game_id, storyboard_url=req.storyboard_url)
    db.add(lesson)
    db.commit()
    return {"status": "ok"}

@app.post("/v1/jobs/{job_id}/fail")
async def job_fail(job_id: str, req: FailRequest, authorization: str = Header(None), db: Session = Depends(get_db)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing authorization header")
    verify_callback_token(job_id, authorization.split(" ")[1])
    
    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
        
    job.status = "error"
    job.message = req.message
    db.commit()
    return {"status": "ok"}

@app.post("/v1/jobs/{job_id}/presigned_put")
async def job_presigned_put(job_id: str, req: PresignedUrlRequest, authorization: str = Header(None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing authorization header")
    verify_callback_token(job_id, authorization.split(" ")[1])
    
    url = get_presigned_put_url(req.file_name, expires_in=3600)
    return {"url": url}

@app.get("/health")
def healthz():
    return {"status": "ok"}
