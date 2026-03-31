from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
import models
from database import get_db
from security import get_current_user

router = APIRouter(prefix="/v1/users", tags=["Users"])

@router.get("/me")
def read_current_user(current_user: models.User = Depends(get_current_user)):
    return {
        "id": current_user.id,
        "username": current_user.username,
        "email": current_user.email,
        "rating": current_user.rating,
        "rank": current_user.rank,
        "analysis_level": current_user.analysis_level,
        "created_at": current_user.created_at
    }

from pydantic import BaseModel
class UserSettingsUpdate(BaseModel):
    analysis_level: int

@router.patch("/me/settings")
def update_user_settings(settings: UserSettingsUpdate, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    from fastapi import HTTPException
    if settings.analysis_level < 1 or settings.analysis_level > 5:
        raise HTTPException(status_code=400, detail="Analysis level must be between 1 and 5.")
    current_user.analysis_level = settings.analysis_level
    db.commit()
    return {"status": "success", "analysis_level": current_user.analysis_level}

@router.get("/me/rating/history")
def get_rating_history(current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    results = db.query(models.GameResult).filter(models.GameResult.user_id == current_user.id).order_by(models.GameResult.created_at.asc()).limit(50).all()
    history = []
    
    # Always include a starting point
    history.append({
        "created_at": current_user.created_at.isoformat() if current_user.created_at else "2024-01-01T00:00:00Z",
        "new_rating": 500, # Base rating
        "points_change": 0,
        "match_type": "initial"
    })
    
    for r in results:
        history.append({
            "created_at": r.created_at.isoformat(),
            "new_rating": r.new_rating,
            "points_change": r.points_change,
            "match_type": r.match_type
        })
        
    return history


@router.get("/me/games")
def get_user_games(current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Fetch the most recent games played by the user."""
    games = db.query(models.PlayerMatch).filter(
        (models.PlayerMatch.black_player_id == current_user.id) |
        (models.PlayerMatch.white_player_id == current_user.id)
    ).order_by(models.PlayerMatch.played_at.desc()).limit(50).all()
    
    result = []
    for g in games:
        opponent = g.white_player if g.black_player_id == current_user.id else g.black_player
        result.append({
            "id": g.id,
            "my_color": "B" if g.black_player_id == current_user.id else "W",
            "opponent_name": opponent.username if opponent else "Unknown",
            "opponent_rank": opponent.rank if opponent else "?",
            "board_size": g.board_size,
            "ruleset": g.ruleset,
            "status": g.status,
            "result": g.result,
            "win_reason": g.win_reason,
            "is_ranked": g.is_ranked,
            "played_at": g.played_at.isoformat() if g.played_at else None
        })
    return result

@router.get("/me/tsumego")
def get_user_tsumego(current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Fetch the most recent Tsumego puzzle attempts by the user."""
    attempts = db.query(models.TsumegoAttempt).filter(
        models.TsumegoAttempt.player_id == current_user.id
    ).order_by(models.TsumegoAttempt.created_at.desc()).limit(50).all()
    
    result = []
    for a in attempts:
        result.append({
            "id": a.id,
            "problem_id": a.problem_id,
            "collection_name": a.puzzle.collection_name if a.puzzle else None,
            "difficulty_rank": a.puzzle.difficulty_rank if a.puzzle else "?",
            "is_correct": a.is_correct,
            "used_hint": a.used_hint,
            "time_spent_seconds": a.time_spent_seconds,
            "created_at": a.created_at.isoformat() if a.created_at else None
        })
    return result

@router.get("/me/rating/history/detailed")
def get_user_detailed_rating_history(current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Fetch a detailed history of point changes."""
    results = db.query(models.GameResult).filter(
        models.GameResult.user_id == current_user.id
    ).order_by(models.GameResult.created_at.desc()).limit(50).all()
    
    formatted_results = []
    for r in results:
        formatted_results.append({
            "id": r.id,
            "match_type": r.match_type,
            "points_change": r.points_change,
            "new_rating": r.new_rating,
            "created_at": r.created_at.isoformat() if r.created_at else None
        })
    return formatted_results
