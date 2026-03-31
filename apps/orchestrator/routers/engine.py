from fastapi import APIRouter, HTTPException
import httpx
import os
from engine_schemas import AnalyzeRequest, AnalyzeResponse

router = APIRouter(prefix="/v1", tags=["engine"])

ENGINE_SERVICE_URL_V1 = os.getenv("ENGINE_SERVICE_URL_V1", "http://localhost:8080")
ENGINE_ROUTE_MODE = os.getenv("ENGINE_ROUTE_MODE", "legacy") # legacy | v1 | flagged
ENGINE_API_KEY = os.getenv("ENGINE_API_KEY", "")

from typing import Optional

@router.post("/analyze-position", response_model=AnalyzeResponse)
async def analyze_position(request: AnalyzeRequest, engine: Optional[str] = None):
    """
    Validation and routing layer. Checks server-side ENGINE_ROUTE_MODE configuration.
    """
    use_v1 = False
    if ENGINE_ROUTE_MODE == "v1":
        use_v1 = True
    elif ENGINE_ROUTE_MODE == "flagged" and engine == "v1":
        # In a real app, inject user verification here (e.g. Depends(get_current_user))
        # and enforce role == 'tester'
        use_v1 = True

    if not use_v1:
        # ----------------------------------------
        # LEGACY CELERY FALLBACK ROUTE
        # ----------------------------------------
        from celery_app import go_celery_app
        try:
            # Map AnalyzeRequest back to flexible dict for old worker
            legacy_payload = request.dict(exclude_none=True)
            task = go_celery_app.send_task(
                "tasks.analyze_board",
                kwargs={"game_id": 0, "board_state": legacy_payload}
            )
            # Block synchronously for the legacy CPU/Remote worker
            resp = task.get(timeout=30)
            
            # The old worker returned {"status": "success", "result": {...}}
            # We map it to the new AnalyzeResponse DTO so the frontend doesn't break
            res = resp.get("result", {})
            if isinstance(res, dict) and "result" in res:
                res = res["result"]
                
            return {
                "request_id": request.request_id,
                "position_hash": "legacy_fallback",
                "winrate_black": res.get("winrate", 0.5),
                "score_lead_black": res.get("scoreLead", 0.0),
                "visits": request.max_visits,
                "top_moves": res.get("hints", []),
                "ownership_map": res.get("ownership", []),
                "engine_metadata": {"degraded_mode": False, "warnings": ["legacy_celery_fallback_used"]}
            }
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))
            
    # ----------------------------------------
    # NEW V1 MICROSERVICE HTTP PROXY
    # ----------------------------------------
    timeout = (request.time_budget_ms / 1000.0) + 5.0
    headers = {"Authorization": f"Bearer {ENGINE_API_KEY}"} if ENGINE_API_KEY else {}
    
    async with httpx.AsyncClient(timeout=timeout) as client:
        try:
            response = await client.post(
                f"{ENGINE_SERVICE_URL_V1}/v1/analyze-position",
                json=request.dict(exclude_none=True),
                headers=headers
            )
            response.raise_for_status()
            return response.json()
            
        except httpx.ReadTimeout:
            raise HTTPException(
                status_code=504, 
                detail={
                    "status": "error",
                    "request_id": request.request_id,
                    "error_code": "ENGINE_TIMEOUT",
                    "is_retryable": True,
                    "retry_after_ms": 5000,
                    "message": "Engine failed to respond.",
                    "engine_state_snapshot": "unavailable"
                }
            )
        except httpx.HTTPStatusError as e:
            try:
                err_payload = e.response.json()
            except:
                err_payload = {"detail": e.response.text}
            raise HTTPException(status_code=e.response.status_code, detail=err_payload)
        except Exception as e:
            raise HTTPException(status_code=500, detail={"error_code": "ORCHESTRATOR_ROUTING_ERROR", "message": str(e)})
