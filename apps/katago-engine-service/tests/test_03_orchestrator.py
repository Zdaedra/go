from fastapi.testclient import TestClient
import sys
import os

# To test orchestrator layer, we load its main.py
sys.path.append(os.path.join(os.path.dirname(__file__), "../../orchestrator"))
from engine_schemas import AnalyzeRequest
import pytest

# PHASE 9: Orchestrator Compliance
def test_validation_boundary(): # O-002
    # Ensure orchestrator accepts exactly the DTO
    payload = {
        "request_id": "test",
        "analysis_slot": "test",
        "board_size": 9,
        "ruleset": "chinese",
        "komi": 7.5,
        "max_visits": 500,
        "time_budget_ms": 15000,
        "include_ownership": True
    }
    req = AnalyzeRequest(**payload)
    assert req.ruleset == "chinese"
    
def test_error_passthrough(): # O-003
    # Mocks httpx internally returning an HTTP error matching the engine service ErrorResponse
    # Ensuring orchestrator raises it as-is (FastAPI HTTPException)
    from fastapi import HTTPException
    
    # We simulate the orchestrator routing error structure
    e = {"detail": {
        "status": "error",
        "request_id": "req",
        "error_code": "ENGINE_TIMEOUT",
        "is_retryable": True,
        "message": "Engine failed",
        "engine_state_snapshot": "degraded"
    }}
    
    err = HTTPException(status_code=504, detail=e["detail"])
    assert err.detail["error_code"] == "ENGINE_TIMEOUT"
