import pytest
from pydantic import ValidationError
from api.schemas import AnalyzeRequest, AnalyzeResponse, ErrorResponse

def test_valid_analyze_request():
    payload = {
        "request_id": "test-123",
        "analysis_slot": "main-board",
        "board_size": 19,
        "ruleset": "japanese",
        "komi": 6.5,
        "initial_position": {
            "black": ["D4"],
            "white": ["Q16"]
        },
        "moves_list": [],
        "side_to_move": "B",
        "max_visits": 500,
        "max_top_moves": 5,
        "time_budget_ms": 15000,
        "include_ownership": True
    }
    req = AnalyzeRequest(**payload)
    assert req.board_size == 19
    assert req.ruleset == "japanese"

def test_invalid_analyze_request_overlap():
    payload = {
        "request_id": "test-overlap",
        "analysis_slot": "main-board",
        "initial_position": {
            "black": ["D4"],
            "white": ["D4"] # overlap!
        }
    }
    with pytest.raises(ValidationError) as exc:
        AnalyzeRequest(**payload)
    assert "overlapping coordinates" in str(exc.value)

def test_analyze_response_bounds():
    payload = {
        "status": "success",
        "request_id": "test",
        "position_hash": "hash",
        "engine_metadata": {
            "version": "1.0",
            "model_name": "x",
            "timing_ms": 100,
            "degraded_mode": False,
            "cache_hit": False
        },
        "analysis": {
            "winrate_black": 1.5, # Invalid! Must be <= 1.0
            "score_lead_black": 10.0,
            "visits": 100,
            "top_moves": []
        }
    }
    with pytest.raises(ValidationError):
        AnalyzeResponse(**payload)

def test_error_response_retryable():
    payload = {
        "status": "error",
        "request_id": "err",
        "error_code": "ENGINE_TIMEOUT",
        "is_retryable": True,
        "message": "timeout",
        "engine_state_snapshot": "degraded"
    }
    err = ErrorResponse(**payload)
    assert err.is_retryable is True
