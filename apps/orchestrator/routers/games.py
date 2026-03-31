from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
import models

router = APIRouter(prefix="/v1/games", tags=["games"])

from typing import Optional

@router.post("/start")
def start_game(board_size: int = 9, site_id: Optional[int] = None, db: Session = Depends(get_db)):
    """Called by the crawler when a game board is detected."""
    if site_id is None:
        default_site = db.query(models.Site).filter(models.Site.name == "online_go_frontend").first()
        if not default_site:
            default_site = models.Site(name="online_go_frontend", base_url="http://localhost:3000", status="Running")
            db.add(default_site)
            db.commit()
            db.refresh(default_site)
        site_id = default_site.id

    # Enforce safety limit: only 1 active game per site at a time
    active_game = db.query(models.Game).filter(
        models.Game.site_id == site_id, 
        models.Game.result == None
    ).first()
    
    if active_game:
        # If there's already an active game, we just return it rather than crashing
        # This handles cases where the crawler reconnects/re-crawls into an existing match
        return {"status": "resumed", "game_id": active_game.id}
        
    game = models.Game(site_id=site_id, board_size=board_size)
    db.add(game)
    db.commit()
    db.refresh(game)
    return {"status": "started", "game_id": game.id}

@router.post("/{game_id}/analyze")
def analyze_board_state(game_id: int, payload: dict, db: Session = Depends(get_db)):
    """
    Called by the crawler to send the current board state.
    Orchestrator will dispatch this to the Go Worker.
    """
    game = db.query(models.Game).filter(models.Game.id == game_id).first()
    if not game:
        raise HTTPException(status_code=404, detail="Game not found")
        
    import celery_app as tasks
    
    # Check if a specific personality was requested
    bot_id = payload.get("bot_id")
    visits = payload.get("visits", 300)
    
    # Apply to payload
    payload["bot_id"] = bot_id
    payload["visits"] = visits

    # Dispatch task to apps/go-worker using Celery
    task = tasks.analyze_board.delay(game_id, payload)
    
    try:
        # Wait for the KataGo engine result (timeout 15s)
        engine_response = task.get(timeout=15)
        
        # Save to DB
        move = models.GameMove(
            game_id=game_id, 
            move_number=payload.get("move_number", 0),
            color=payload.get("to_play", "W"),
            coordinate=engine_response.get("result", {}).get("best_move", "PASS")
        )
        db.add(move)
        db.commit()
        
        return engine_response
    except Exception as e:
        import traceback
        return {
            "status": "error", 
            "message": "Timed out waiting for KataGo engine or worker failed",
            "details": str(e),
            "trace": traceback.format_exc()
        }
@router.post("/analyze/stateless")
def analyze_stateless(payload: dict):
    """
    Stateless endpoint for analyzing any board position without tying it to a database game.
    Used for Post-Game Review mode to fetch hints for historical boards.
    """
    from celery_app import go_celery_app
    
    bot_id = payload.get("bot_id", "amateur")
    visits = payload.get("visits", 300)
    
    payload["bot_id"] = bot_id
    payload["visits"] = visits
    
    try:
        # Route locally onto Hetzner AMD EPYC CPU Worker to bypass the dead Vast API
        task = go_celery_app.send_task(
            "tasks.analyze_board",
            kwargs={"game_id": 0, "board_state": payload}
        )
        # Block synchronously until the CPU engine extracts the move
        resp = task.get(timeout=120)
        
        # The CPU worker wraps KataGo output as: {"status": "success", "game_id": game_id, "result": result}
        # But `katago.tsx` expects the raw structure: {"status": "success", "result": {"best_move": "..."}}
        if resp.get("status") == "success":
            return resp
        else:
            return {"status": "error", "message": resp.get("error", "Unknown engine error")}
            
    except Exception as e:
        import traceback
        return {
            "status": "error", 
            "message": "Timed out waiting for KataGo analyzer",
            "details": str(e)
        }

@router.post("/{game_id}/end")
def end_game(game_id: int, result: str, db: Session = Depends(get_db)):
    """Called by crawler when the game finishes or times out."""
    game = db.query(models.Game).filter(models.Game.id == game_id).first()
    if not game:
        raise HTTPException(status_code=404, detail="Game not found")
        
    game.result = result
    db.commit()
    return {"status": "ended", "game_id": game_id, "result": result}

import asyncio
import requests

@router.post("/review")
async def analyze_full_game(payload: dict):
    """
    Receives an array of board states for an entire game timeline.
    Sends them concurrently to Vast.ai KataGo and calculates Winrate/ScoreLead drops.
    Identifies 'Mistakes' (>10% drop) and 'Blunders' (>20% drop).
    """
    moves_history = payload.get("moves_history", [])
    if not moves_history:
        return {"status": "error", "message": "No moves provided"}
    
    LOCAL_ENDPOINT = "http://localhost:8000/v1/games/analyze/stateless"
    
    def fetch_turn(turn_idx, state_payload):
        try:
            resp = requests.post(LOCAL_ENDPOINT, json=state_payload, timeout=60)
            resp.raise_for_status()
            return turn_idx, resp.json()
        except Exception as e:
            return turn_idx, None

    # Fire all requests concurrently using thread pool
    tasks = []
    for idx, state in enumerate(moves_history):
        state["bot_id"] = "sensei"
        state["visits"] = 300 # Emulate Vast GPU depth locally
        tasks.append(asyncio.to_thread(fetch_turn, idx, state))
        
    responses_tuple = await asyncio.gather(*tasks)
    responses = list(responses_tuple)
    responses.sort(key=lambda x: x[0])
    
    mistakes = []
    full_analysis = {}
    
    for i in range(1, len(responses)):
        prev_idx, prev_data = responses[i-1]
        curr_idx, curr_data = responses[i]
        
        if not prev_data or not curr_data:
            continue
            
        def extract_winrate(data):
            res = data.get("result")
            if not isinstance(res, dict): return 0.5
            if "result" in res and isinstance(res["result"], dict):
                res = res["result"]
            val = res.get("winrate")
            return val if val is not None else 0.5

        def extract_scorelead(data):
            res = data.get("result")
            if not isinstance(res, dict): return 0.0
            if "result" in res and isinstance(res["result"], dict):
                res = res["result"]
            val = res.get("scoreLead")
            return val if val is not None else 0.0

        def extract_hints(data):
            res = data.get("result")
            if not isinstance(res, dict): return []
            if "result" in res and isinstance(res["result"], dict):
                res = res["result"]
            return res.get("hints", [])

        def extract_ownership(data):
            res = data.get("result")
            if not isinstance(res, dict): return []
            if "result" in res and isinstance(res["result"], dict):
                res = res["result"]
            return res.get("ownership", [])

        prev_winrate = extract_winrate(prev_data)
        curr_winrate = extract_winrate(curr_data)
        
        prev_sl = extract_scorelead(prev_data)
        curr_sl = extract_scorelead(curr_data)
        
        # Populate index 0 if it's the first historical move
        if i == 1:
            initial_to_play = moves_history[0].get("to_play", "B")
            initial_is_white = initial_to_play == "W"
            initial_black_winrate = (1.0 - prev_winrate) if initial_is_white else prev_winrate
            initial_black_sl = -prev_sl if initial_is_white else prev_sl
            full_analysis[0] = { "winrate": initial_black_winrate, "scoreLead": initial_black_sl }
            
        to_play = moves_history[i-1].get("to_play", "B")
        
        curr_to_play = moves_history[i].get("to_play", "B")
        curr_is_white = curr_to_play == "W"
        
        # Orient the extracted stats from Black's perspective to mount identically to katago.tsx internal history expectations
        black_winrate = (1.0 - curr_winrate) if curr_is_white else curr_winrate
        black_sl = -curr_sl if curr_is_white else curr_sl
        full_analysis[curr_idx] = { "winrate": black_winrate, "scoreLead": black_sl }
        
        winrate_drop = prev_winrate - (1.0 - curr_winrate)
        
        # Orient score lead for the active player
        # If Black to play: We want (Black score before) - (Black score after)
        # If White to play: We want (White score before) - (White score after)
        # Note: prev_sl is from the perspective of to_play (active player), curr_sl is from perspective of opponent
        # So active player's score after move is -curr_sl
        score_drop = prev_sl - (-curr_sl)
        
        is_blunder = winrate_drop > 0.20 or score_drop > 8.0
        is_mistake = (winrate_drop > 0.10 or score_drop > 4.0) and not is_blunder
        
        if is_mistake or is_blunder:
            mistakes.append({
                "turn": curr_idx, 
                "player": to_play,
                "winrate_drop": winrate_drop,
                "score_drop": score_drop,
                "type": "blunder" if is_blunder else "mistake",
                "state_before": moves_history[i-1],
                "played_move": moves_history[i].get("last_move"),
                "optimal_moves": extract_hints(prev_data),
                "ownership": extract_ownership(prev_data)
            })
            
    return {"status": "success", "mistakes": mistakes, "full_analysis": full_analysis}
