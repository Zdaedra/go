from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
import models

router = APIRouter(prefix="/v1/games", tags=["games"])

@router.post("/start")
def start_game(site_id: int, board_size: int = 9, db: Session = Depends(get_db)):
    """Called by the crawler when a game board is detected."""
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
    
    # Dispatch task to apps/go-worker using Celery
    tasks.analyze_board.delay(game_id, payload)
    
    return {
        "status": "queued", 
        "message": "Board state analysis queued for Go Worker"
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
