from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import or_
import models
from database import get_db
from security import get_current_user
from typing import List, Any

router = APIRouter(prefix="/v1/matches", tags=["Matches"])

@router.get("/live")
def get_live_matches(
    db: Session = Depends(get_db)
) -> Any:
    matches = db.query(models.PlayerMatch).filter(
        models.PlayerMatch.status == "active"
    ).order_by(models.PlayerMatch.played_at.desc()).limit(50).all()
    
    result = []
    for match in matches:
        black = match.black_player
        white = match.white_player
        result.append({
            "id": match.id,
            "board_size": match.board_size,
            "time_preset": match.time_preset,
            "black_player": black.username if black else "Unknown",
            "black_rating": black.rating if black else "?",
            "white_player": white.username if white else "Unknown",
            "white_rating": white.rating if white else "?",
            "is_ranked": match.is_ranked,
            "played_at": match.played_at
        })
    return result

@router.get("/history")
def get_match_history(
    skip: int = 0, 
    limit: int = 20, 
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Any:
    matches = db.query(models.PlayerMatch).filter(
        or_(
            models.PlayerMatch.black_player_id == current_user.id,
            models.PlayerMatch.white_player_id == current_user.id
        )
    ).order_by(models.PlayerMatch.played_at.desc()).offset(skip).limit(limit).all()
    
    result = []
    for match in matches:
        is_black = match.black_player_id == current_user.id
        opponent = match.white_player if is_black else match.black_player
        
        # Determine win/loss from current player's perspective simplified
        # result string format assumption: 'B+Resign', 'W+5.5', etc
        won = False
        if match.result:
            if (is_black and match.result.startswith('B+')) or (not is_black and match.result.startswith('W+')):
                won = True
                
        result.append({
            "id": match.id,
            "board_size": match.board_size,
            "time_preset": match.time_preset,
            "opponent_name": opponent.username if opponent else "Unknown",
            "opponent_rank": opponent.rank if opponent else "?",
            "played_as": "black" if is_black else "white",
            "match_result": match.result,
            "won": won,
            "is_ranked": match.is_ranked,
            "played_at": match.played_at,
            "sgf_data": match.sgf_data
        })
        
    return result

from pydantic import BaseModel
from typing import Optional

class BotAnalyzeRequest(BaseModel):
    match_id: Optional[int] = None
    komi: float = 6.5
    board_size: int = 19
    black_stones: List[str] = []
    white_stones: List[str] = []
    to_play: str = "W"
    move_number: int = 1
    bot_id: str = "amateur"
    last_played_move: Optional[str] = None

@router.post("/bot/analyze")
def bot_analyze(payload: BotAnalyzeRequest, db: Session = Depends(get_db)):
    """
    Stateful endpoint for bot analysis. 
    Creates or loads a PlayerMatch, logs the user's move, invokes Katago, logs Katago's move.
    """
    from celery_app import go_celery_app
    
    match = None
    if payload.match_id:
        match = db.query(models.PlayerMatch).filter(models.PlayerMatch.id == payload.match_id).first()
        
    if not match:
        match = models.PlayerMatch(
            match_type="bot",
            bot_id=payload.bot_id,
            board_size=payload.board_size,
            ruleset="japanese",
            time_preset="none",
            status="active"
        )
        db.add(match)
        db.commit()
        db.refresh(match)
        
    # Log Human Move if provided
    if payload.last_played_move:
        human_color = "B" if payload.to_play == "W" else "W"
        db.add(models.MatchMove(
            match_id=match.id,
            move_number=payload.move_number - 1,
            color=human_color,
            coordinate=payload.last_played_move
        ))
        db.commit()

    # Fetch Bot Move via Celery
    try:
        task = go_celery_app.send_task(
            "tasks.analyze_board",
            kwargs={"game_id": match.id, "board_state": payload.dict(exclude={"match_id", "last_played_move"})}
        )
        resp = task.get(timeout=20)
        
        # Save Bot Move
        if resp.get("status") == "success":
            actual_result = resp.get("result", {})
            if "result" in actual_result and isinstance(actual_result["result"], dict):
                actual_result = actual_result["result"]
                
            best_move = actual_result.get("best_move", "PASS")
            
            db.add(models.MatchMove(
                match_id=match.id,
                move_number=payload.move_number,
                color=payload.to_play,
                coordinate=best_move
            ))
            db.commit()
            
            # Mount match_id into response so frontend can persist it
            resp["match_id"] = match.id
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
