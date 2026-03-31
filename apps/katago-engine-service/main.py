from fastapi import FastAPI, HTTPException, Request, Depends
from fastapi.responses import JSONResponse
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import logging
import asyncio
import os
import time

from api.schemas import AnalyzeRequest, AnalyzeResponse, ErrorResponse, EngineInfoResponse
from engine import process_manager
from watchdog import watchdog_loop

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("katago-engine")

ENGINE_API_KEY = os.getenv("ENGINE_API_KEY", "")
security = HTTPBearer()

def verify_api_key(credentials: HTTPAuthorizationCredentials = Depends(security)):
    if engines_api_key := ENGINE_API_KEY:
        if credentials.credentials != engines_api_key:
            raise HTTPException(status_code=401, detail="Invalid API Key")
    return credentials.credentials

app = FastAPI(title="KataGo Engine Service", version="1.0.0", dependencies=[Depends(verify_api_key)])


@app.on_event("startup")
async def startup_event():
    await process_manager.start()
    asyncio.create_task(watchdog_loop())

@app.on_event("shutdown")
async def shutdown_event():
    if process_manager.proc:
        process_manager.proc.terminate()

@app.post("/v1/analyze-position", response_model=AnalyzeResponse)
async def analyze_position_endpoint(req: AnalyzeRequest):
    try:
        if process_manager.health_state == "unavailable":
            raise HTTPException(status_code=503, detail="Engine Unavailable")
        resp = await process_manager.process_analysis(req)
        return resp
    except Exception as e:
        logger.error(f"Analysis failed: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/v1/engine-info", response_model=EngineInfoResponse)
async def engine_info_endpoint():
    return EngineInfoResponse(
        version="1.15.1",
        model=process_manager.proc.args[2] if process_manager.proc else "unknown",
        uptime=int(time.time() - process_manager.uptime_start),
        restart_count=process_manager.restart_count,
        health_state=process_manager.health_state,
        queue_depth=len(process_manager.slot_queue),
        active_request_id=process_manager.active_request_id,
        last_watchdog_success_at=str(process_manager.last_watchdog_success_at) if process_manager.last_watchdog_success_at else None,
        last_restart_at=str(process_manager.last_restart_at) if process_manager.last_restart_at else None
    )

@app.get("/health/live")
async def health_live():
    return {"status": "alive"}

@app.get("/health/readiness")
async def health_readiness():
    if process_manager.health_state != "healthy":
        raise HTTPException(status_code=503, detail="Degraded or Restarting")
    return {"status": "ready"}
