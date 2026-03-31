import pytest
import asyncio
from api.schemas import AnalyzeRequest
from engine import KataGoProcessManager

# Golden Positions dictionary ensures the top move matches expectations
GOLDEN_POSITIONS = [
    {
        "name": "Empty 9x9 opening",
        "payload": {
            "request_id": "gp-1",
            "analysis_slot": "regression",
            "board_size": 9,
            "komi": 6.5,
            "max_visits": 500,
        },
        "expected_top_move_choices": ["E5", "D5", "E4", "D4"], # Tengen or 4-4
        "min_winrate": 0.40,
        "max_winrate": 0.55
    },
    {
        "name": "Simple Atari (9x9)",
        "payload": {
            "request_id": "gp-2",
            "analysis_slot": "regression",
            "board_size": 9,
            "komi": 6.5,
            "initial_position": {
                "black": ["E5"],
                "white": ["E6", "D5", "F5"] 
            },
            "side_to_move": "W",
            "max_visits": 300,
        },
        "expected_top_move_choices": ["E4"], # capturing or atari move
        "min_winrate": 0.05,
        "max_winrate": 0.45
    }
]

@pytest.mark.asyncio
async def test_golden_positions():
    """
    Spawns the local KataGo process and runs the statistical stability pipeline.
    Validates rank-stability rather than exact precision.
    """
    manager = KataGoProcessManager()
    await manager.start()
    
    try:
        for pos in GOLDEN_POSITIONS:
            req = AnalyzeRequest(**pos["payload"])
            
            resp = await manager.process_analysis(req)
            
            assert resp.status == "success"
            
            # 1. Rank Stability Validation
            top_move = resp.analysis.top_moves[0].move
            assert top_move in pos["expected_top_move_choices"], f"Failed Golden Position: {pos['name']}. Engine chose {top_move}."
            
            # 2. Statistical Deviation Validation
            winrate = resp.analysis.winrate_black
            assert pos["min_winrate"] <= winrate <= pos["max_winrate"], f"Winrate anomaly on {pos['name']}: {winrate}"
            
    finally:
        if manager.proc:
            manager.proc.terminate()
