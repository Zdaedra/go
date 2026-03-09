import json
import asyncio
from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session
from database import get_db
import models
from pydantic import BaseModel
from typing import Optional, Any
from sse_starlette.sse import EventSourceResponse

router = APIRouter(prefix="/v1/logs", tags=["Logs"])

# In-memory queues for connected SSE clients
clients = []

class LogEntry(BaseModel):
    site_id: int
    run_id: int
    level: str
    message: str
    payload: Optional[Any] = None

@router.post("/")
async def create_log(log: LogEntry, db: Session = Depends(get_db)):
    """ Endpoint for Crawler to push live logs """
    new_log = models.Log(
        level=log.level,
        message=f"[Site {log.site_id} | Run {log.run_id}] {log.message}"
    )
    db.add(new_log)
    db.commit()

    # Broadcast to all connected SSE clients
    for client in clients:
        await client.put(log.dict())
        
    return {"status": "ok"}

@router.get("/stream")
async def log_stream(request: Request):
    """ SSE Endpoint for Dashboard to listen to logs """
    q = asyncio.Queue()
    clients.append(q)

    async def event_generator():
        try:
            while True:
                # Wait for disconnected client
                if await request.is_disconnected():
                    break

                # Wait for a new log msg
                data = await q.get()
                yield {
                    "event": "log",
                    "data": json.dumps(data)
                }
        finally:
            clients.remove(q)

    return EventSourceResponse(event_generator())
