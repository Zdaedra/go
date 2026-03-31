from pydantic import BaseModel, Field, root_validator
from typing import List, Optional, Literal

class InitialPosition(BaseModel):
    black: List[str] = Field(default_factory=list, description="List of black stones in GTP vertex notation")
    white: List[str] = Field(default_factory=list, description="List of white stones in GTP vertex notation")

    @root_validator(pre=True)
    def check_overlap(cls, values):
        black_set = set(values.get("black", []))
        white_set = set(values.get("white", []))
        if black_set & white_set:
            raise ValueError("initial_position contains overlapping coordinates between black and white")
        return values

class AnalyzeRequest(BaseModel):
    request_id: str = Field(..., description="Unique ID for this request")
    analysis_slot: str = Field(..., description="Logical slot for Latest-Wins queuing")
    board_size: int = Field(default=9, ge=9, le=19)
    ruleset: Literal["japanese", "chinese", "tromp-taylor", "aga"] = "japanese"
    komi: float = 6.5
    initial_position: Optional[InitialPosition] = None
    moves_list: List[str] = Field(default_factory=list, description="Ordered sequence of moves in GTP notation")
    side_to_move: Optional[Literal["B", "W"]] = None
    max_visits: int = Field(default=500, gt=0)
    max_top_moves: int = Field(default=5, gt=0)
    time_budget_ms: int = Field(default=15000, gt=0)
    include_ownership: bool = Field(default=True)

class EngineMetadata(BaseModel):
    version: str
    model_name: str
    timing_ms: int
    degraded_mode: bool
    cache_hit: bool

class CandidateMove(BaseModel):
    move: str
    order: int
    winrate_black: float = Field(..., ge=0.0, le=1.0)
    lcb_winrate_black: float = Field(..., ge=0.0, le=1.0)
    score_lead_black: float
    utility: float
    visits: int
    policy: float = Field(..., ge=0.0, le=1.0)
    is_policy_fallback: bool
    pv: List[str]

class AnalysisResult(BaseModel):
    winrate_black: float = Field(..., ge=0.0, le=1.0)
    score_lead_black: float
    visits: int
    legal_moves_count: Optional[int] = None
    ownership_map: Optional[List[float]] = None
    top_moves: List[CandidateMove]

class AnalyzeResponse(BaseModel):
    status: Literal["success"] = "success"
    request_id: str
    position_hash: str
    engine_metadata: EngineMetadata
    warnings: List[str] = Field(default_factory=list)
    analysis: AnalysisResult

class ErrorResponse(BaseModel):
    status: Literal["error"] = "error"
    request_id: str
    error_code: Literal["ENGINE_TIMEOUT", "GPU_OOM_RESTARTING", "GTP_CRASH", "INVALID_COORDINATE_FORMAT", "ILLEGAL_MOVE_REQUESTED", "UNSUPPORTED_BOARD_SIZE"]
    is_retryable: bool
    retry_after_ms: Optional[int] = None
    message: str
    engine_state_snapshot: Literal["healthy", "degraded", "restarting", "unavailable"]

class EngineInfoResponse(BaseModel):
    version: str
    model: str
    uptime: int
    restart_count: int
    health_state: Literal["healthy", "degraded", "restarting", "unavailable"]
    active_request_id: Optional[str] = None
    queue_depth: int
    last_watchdog_success_at: Optional[str] = None
    last_restart_at: Optional[str] = None
