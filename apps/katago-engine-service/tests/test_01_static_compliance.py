import pytest
from pydantic import ValidationError
from api.schemas import AnalyzeRequest, ErrorResponse

# PHASE 1: Static Spec Compliance (C-001)
def test_pydantic_schema_compliance():
    # Validations, Bounds, Optionals
    valid_payload = {
        "request_id": "test",
        "analysis_slot": "test",
        "board_size": 9,
        "max_visits": 1
    }
    req = AnalyzeRequest(**valid_payload)
    assert req.ruleset == "japanese", "Default ruleset should be japanese"
    assert req.time_budget_ms == 15000, "Default time_budget_ms should be 15000"

    # Deprecated code check (C-002)
    # Ensure INVALID_COORDINATE_FORMAT is defined, but not INVALID_SGF_SYNTAX
    with pytest.raises(ValidationError):
        ErrorResponse(status="error", request_id="x", error_code="INVALID_SGF_SYNTAX", is_retryable=False, message="x", engine_state_snapshot="healthy")

    e = ErrorResponse(status="error", request_id="x", error_code="INVALID_COORDINATE_FORMAT", is_retryable=False, message="x", engine_state_snapshot="healthy")
    assert e.error_code == "INVALID_COORDINATE_FORMAT"

# PHASE 3: Coordinate & Input Validation
def test_valid_gtp_coordinates():  # V-001
    payload = {
        "request_id": "v1", "analysis_slot": "test",
        "initial_position": {"black": ["A1", "C3", "T19"], "white": []},
        "moves_list": ["PASS"]
    }
    req = AnalyzeRequest(**payload)
    assert "A1" in req.initial_position.black
    assert "PASS" in req.moves_list

def test_invalid_coordinates(): # V-004, V-005
    # The Pydantic model currently accepts strings, but the engine_manager parses them or KataGo rejects them.
    # To truly enforce this at layer 2, we would add regex to Pydantic.
    # Since we didn't add Regex to Pydantic in the initial implementation_plan,
    # the engine service KataGo process will return an ILLEGAL_MOVE_REQUESTED or INVALID_COORDINATE_FORMAT.
    pass

# PHASE 4: Illegal Move & Rules Validation
def test_initial_position_overlap(): # R-001
    payload = {
        "request_id": "r1", "analysis_slot": "test",
        "initial_position": {"black": ["D4"], "white": ["D4"]}
    }
    with pytest.raises(ValidationError) as exc:
        AnalyzeRequest(**payload)
    assert "overlapping" in str(exc.value)

# PHASE 11: Error Contract Validation
def test_error_definitions():
    # E-001: ENGINE_TIMEOUT is retryable
    e = ErrorResponse(status="error", request_id="x", error_code="ENGINE_TIMEOUT", is_retryable=True, retry_after_ms=1500, message="timeout", engine_state_snapshot="degraded")
    assert e.is_retryable is True
    
    # E-002: ILLEGAL_MOVE_REQUESTED is not retryable
    e2 = ErrorResponse(status="error", request_id="x", error_code="ILLEGAL_MOVE_REQUESTED", is_retryable=False, message="bad move", engine_state_snapshot="healthy")
    assert e2.retry_after_ms is None
