from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from typing import List, Dict, Any, Optional
from datetime import datetime
from database import get_db
from security import get_current_user, get_current_user_optional
from models import TsumegoCollection, TsumegoPuzzle, TsumegoTag, TsumegoAttempt, User
from utils_rating import calculate_rating_change, calculate_rank, compare_levels

router = APIRouter(prefix="/v1/tsumego", tags=["Tsumego"])

class AttemptCreate(BaseModel):
    is_correct: bool
    used_hint: bool = False
    time_spent_seconds: int

@router.get("/collections")
def list_collections(db: Session = Depends(get_db)):
    collections = db.query(TsumegoCollection).all()
    return collections

@router.get("/collections/{collection_id}/puzzles")
def list_puzzles_in_collection(
    collection_id: str, 
    limit: int = 50, 
    offset: int = 0, 
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional)
):
    puzzles = db.query(TsumegoPuzzle).filter(TsumegoPuzzle.collection_id == collection_id).offset(offset).limit(limit).all()
    
    # Pre-fetch solved status and attempts if user is logged in
    user_progress_map = {}
    if current_user:
        attempts = db.query(TsumegoAttempt).filter(TsumegoAttempt.player_id == current_user.id).all()
        
        # Sort by creation logic not guaranteed, so track failures explicitly
        for att in attempts:
            if att.problem_id not in user_progress_map:
                user_progress_map[att.problem_id] = {"status": "unattempted", "time_spent_seconds": 999999, "failed_count": 0}
                
            prev = user_progress_map[att.problem_id]
            current_status = prev["status"]
            
            if att.is_correct:
                if att.used_hint:
                    # Hints override other passed states for now
                    user_progress_map[att.problem_id]["status"] = "passed_with_hint"
                elif current_status != "passed_with_hint":
                    if prev["failed_count"] > 0 or current_status == "passed_with_errors":
                        user_progress_map[att.problem_id]["status"] = "passed_with_errors"
                    else:
                        user_progress_map[att.problem_id]["status"] = "passed_clean"
                        
                # Update best time
                if att.time_spent_seconds < prev["time_spent_seconds"]:
                    user_progress_map[att.problem_id]["time_spent_seconds"] = att.time_spent_seconds
            else:
                user_progress_map[att.problem_id]["failed_count"] += 1
                if current_status == "unattempted":
                    user_progress_map[att.problem_id]["status"] = "failed"
                elif current_status == "passed_clean":
                    # If they passed clean earlier but then failed later (or out of order array), 
                    # let's mark it as passed_with_errors just in case.
                    user_progress_map[att.problem_id]["status"] = "passed_with_errors"
                
        # cleanup default time
        for p_id, prog in user_progress_map.items():
            if prog["time_spent_seconds"] == 999999:
                prog["time_spent_seconds"] = 0
    
    # format and join with tags and collections for richer UI
    results = []
    for p in puzzles:
        prog = user_progress_map.get(p.id, {"status": "unattempted", "time_spent_seconds": 0})
        is_solved = prog["status"] in ["passed_clean", "passed_with_hint", "passed_with_errors"]
        
        results.append({
            "id": p.id,
            "source_key": p.source_key,
            "board_width": p.board_width,
            "board_height": p.board_height,
            "to_play": p.to_play,
            "goal_type": p.goal_type,
            "difficulty_source": p.difficulty_source,
            "title": p.title,
            "board_position": p.board_position,
            "solution": p.solution,
            "difficulty_level": p.difficulty_level,
            "difficulty_rank": p.difficulty_rank,
            "difficulty_relation": compare_levels(current_user.puzzle_rating, p.problem_rating or 100) if current_user else "UNKNOWN",
            "tags": [t.name for t in getattr(p, 'tags', [])],
            "collection_name": p.collection.name if p.collection else None,
            "is_solved_by_user": is_solved,
            "user_progress": prog
        })
    return results

@router.get("/puzzles")
def list_all_puzzles(
    limit: int = 50, 
    offset: int = 0, 
    goal_type: Optional[str] = None,
    db: Session = Depends(get_db), 
    current_user: Optional[User] = Depends(get_current_user_optional)
):
    query = db.query(TsumegoPuzzle)
    if goal_type:
        query = query.filter(TsumegoPuzzle.goal_type == goal_type)
        
    puzzles = query.offset(offset).limit(limit).all()
    
    # Pre-fetch solved status and attempts if user is logged in
    user_progress_map = {}
    if current_user:
        attempts = db.query(TsumegoAttempt).filter(TsumegoAttempt.player_id == current_user.id).all()
        
        # Sort by creation logic not guaranteed, so track failures explicitly
        for att in attempts:
            if att.problem_id not in user_progress_map:
                user_progress_map[att.problem_id] = {"status": "unattempted", "time_spent_seconds": 999999, "failed_count": 0}
                
            prev = user_progress_map[att.problem_id]
            current_status = prev["status"]
            
            if att.is_correct:
                if att.used_hint:
                    # Hints override other passed states for now
                    user_progress_map[att.problem_id]["status"] = "passed_with_hint"
                elif current_status != "passed_with_hint":
                    if prev["failed_count"] > 0 or current_status == "passed_with_errors":
                        user_progress_map[att.problem_id]["status"] = "passed_with_errors"
                    else:
                        user_progress_map[att.problem_id]["status"] = "passed_clean"
                        
                # Update best time
                if att.time_spent_seconds < prev["time_spent_seconds"]:
                    user_progress_map[att.problem_id]["time_spent_seconds"] = att.time_spent_seconds
            else:
                user_progress_map[att.problem_id]["failed_count"] += 1
                if current_status == "unattempted":
                    user_progress_map[att.problem_id]["status"] = "failed"
                elif current_status == "passed_clean":
                    # If they passed clean earlier but then failed later (or out of order array), 
                    # let's mark it as passed_with_errors just in case.
                    user_progress_map[att.problem_id]["status"] = "passed_with_errors"
                
        # cleanup default time
        for p_id, prog in user_progress_map.items():
            if prog["time_spent_seconds"] == 999999:
                prog["time_spent_seconds"] = 0
    
    # join with tags and collections for richer UI
    results = []
    for p in puzzles:
        prog = user_progress_map.get(p.id, {"status": "unattempted", "time_spent_seconds": 0})
        is_solved = prog["status"] in ["passed_clean", "passed_with_hint", "passed_with_errors"]
        
        results.append({
            "id": p.id,
            "source_key": p.source_key,
            "board_width": p.board_width,
            "board_height": p.board_height,
            "to_play": p.to_play,
            "goal_type": p.goal_type,
            "difficulty_source": p.difficulty_source,
            "title": p.title,
            "board_position": p.board_position,
            "solution": p.solution,
            "difficulty_level": p.difficulty_level,
            "difficulty_rank": p.difficulty_rank,
            "difficulty_relation": compare_levels(current_user.puzzle_rating, p.problem_rating or 100) if current_user else "UNKNOWN",
            "tags": [t.name for t in getattr(p, 'tags', [])],
            "collection_name": p.collection.name if p.collection else None,
            "is_solved_by_user": is_solved,
            "user_progress": prog
        })
    return results

import random

@router.get("/puzzles/mix")
def get_mixed_practice_puzzles(
    limit: int = 10,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Returns an adaptive mix of puzzles based on user's puzzle_rating.
    Window: [Rating - 200, Rating + 100]. Widen if necessary.
    """
    user_rating = current_user.puzzle_rating if current_user.puzzle_rating else 1000
    
    # 1. Get IDs of puzzles already solved by the user
    solved_attempts = db.query(TsumegoAttempt.problem_id).filter(
        TsumegoAttempt.player_id == current_user.id,
        TsumegoAttempt.is_correct == True
    ).all()
    solved_puzzle_ids = {r[0] for r in solved_attempts}
    
    # 2. Iteratively search for puzzles matching the Elo window
    bounds_expansion = 0
    candidate_puzzles = []
    
    while len(candidate_puzzles) < limit and bounds_expansion <= 500:
        min_rating = user_rating - 200 - bounds_expansion
        max_rating = user_rating + 100 + bounds_expansion
        
        query = db.query(TsumegoPuzzle).filter(
            TsumegoPuzzle.id.notin_(solved_puzzle_ids) if solved_puzzle_ids else True,
            TsumegoPuzzle.problem_rating >= min_rating,
            TsumegoPuzzle.problem_rating <= max_rating
        ).limit(100) # Fetch a batch of candidates
        
        candidates = query.all()
        candidate_puzzles = list({p.id: p for p in (candidate_puzzles + candidates)}.values()) # Unique merge
        
        bounds_expansion += 100
        
    # Also fetch random if we STILL don't have enough (exhausted database)
    if len(candidate_puzzles) < limit:
        random_filler = db.query(TsumegoPuzzle).filter(
            TsumegoPuzzle.id.notin_(solved_puzzle_ids) if solved_puzzle_ids else True
        ).limit(limit).all()
        candidate_puzzles = list({p.id: p for p in (candidate_puzzles + random_filler)}.values())
        
    # 3. Shuffle and pick exactly 'limit'
    random.shuffle(candidate_puzzles)
    selected_puzzles = candidate_puzzles[:limit]
    
    # Pre-fetch solved status and attempts if user is logged in
    user_progress_map = {}
    attempts = db.query(TsumegoAttempt).filter(TsumegoAttempt.player_id == current_user.id).all()
    for att in attempts:
        if att.problem_id not in user_progress_map:
            user_progress_map[att.problem_id] = {"status": "unattempted", "time_spent_seconds": 999999, "failed_count": 0}
            
        prev = user_progress_map[att.problem_id]
        current_status = prev["status"]
        
        if att.is_correct:
            if att.used_hint:
                user_progress_map[att.problem_id]["status"] = "passed_with_hint"
            elif current_status != "passed_with_hint":
                if prev["failed_count"] > 0 or current_status == "passed_with_errors":
                    user_progress_map[att.problem_id]["status"] = "passed_with_errors"
                else:
                    user_progress_map[att.problem_id]["status"] = "passed_clean"
                    
            if att.time_spent_seconds < prev["time_spent_seconds"]:
                user_progress_map[att.problem_id]["time_spent_seconds"] = att.time_spent_seconds
        else:
            user_progress_map[att.problem_id]["failed_count"] += 1
            if current_status == "unattempted":
                user_progress_map[att.problem_id]["status"] = "failed"
            elif current_status == "passed_clean":
                user_progress_map[att.problem_id]["status"] = "passed_with_errors"
                
    for p_id, prog in user_progress_map.items():
        if prog["time_spent_seconds"] == 999999:
            prog["time_spent_seconds"] = 0
    # Format the response
    results = []
    for p in selected_puzzles:
        prog = user_progress_map.get(p.id, {"status": "unattempted", "time_spent_seconds": 0})
        is_solved = prog["status"] in ["passed_clean", "passed_with_hint", "passed_with_errors"]
        
        results.append({
            "id": p.id,
            "source_key": p.source_key,
            "board_width": p.board_width,
            "board_height": p.board_height,
            "to_play": p.to_play,
            "goal_type": p.goal_type,
            "difficulty_source": p.difficulty_source,
            "title": p.title,
            "board_position": p.board_position,
            "solution": p.solution,
            "difficulty_level": p.difficulty_level,
            "difficulty_rank": p.difficulty_rank,
            "difficulty_relation": compare_levels(user_rating, p.problem_rating or 100),
            "tags": [t.name for t in getattr(p, 'tags', [])],
            "collection_name": p.collection.name if p.collection else None,
            "is_solved_by_user": is_solved,
            "user_progress": prog
        })
    return results

def process_problem_result(db: Session, current_user: User, puzzle: TsumegoPuzzle, attempt_data: AttemptCreate) -> dict:
    """
    Step 12: Алгоритм обработки решения задачи
    """
    # 1. получить результат решения
    is_correct = attempt_data.is_correct
    time_spent_seconds = attempt_data.time_spent_seconds
    
    # 2. определить номер попытки
    previous_attempts_count = db.query(TsumegoAttempt).filter(
        TsumegoAttempt.problem_id == puzzle.id,
        TsumegoAttempt.player_id == current_user.id
    ).count()
    attempt_number = previous_attempts_count + 1
    
    previously_solved = db.query(TsumegoAttempt).filter(
        TsumegoAttempt.problem_id == puzzle.id,
        TsumegoAttempt.player_id == current_user.id,
        TsumegoAttempt.is_correct == True
    ).first() is not None
    
    # 3. сравнить уровни (happens inside calculate_rating_change)
    p_rating = current_user.puzzle_rating if current_user.puzzle_rating else 1000
    prob_rating = puzzle.problem_rating if puzzle.problem_rating else 100
    
    # 4. рассчитать ΔРО & 5. применить бонус скорости
    delta_player, delta_problem = calculate_rating_change(
        player_rating=p_rating,
        problem_rating=prob_rating,
        attempt_number=attempt_number,
        is_correct=is_correct,
        previously_solved=previously_solved,
        time_spent_seconds=time_spent_seconds
    )
    
    # 6. обновить рейтинг
    new_player_rating = p_rating + delta_player
    if new_player_rating < 0: new_player_rating = 0
        
    new_problem_rating = prob_rating + delta_problem
    if new_problem_rating < 0: new_problem_rating = 0
        
    current_user.puzzle_rating = new_player_rating
    puzzle.problem_rating = new_problem_rating
    
    # Step 16: Dynamic Problem Difficulty
    # Synchronize the public 1-29 level and Kyu/Dan string with its floating Elo
    from utils_rating import get_numeric_level
    puzzle.difficulty_level = get_numeric_level(new_problem_rating)
    puzzle.difficulty_rank = calculate_rank(new_problem_rating, 100) # problems don't get '?' preliminary sign
    
    # 8. начислить СО & 9. увеличить problems_solved
    earned_points = 0
    if is_correct and not previously_solved:
        modifier = 2 if previous_attempts_count == 0 else 1
        difficulty = puzzle.difficulty_level if puzzle.difficulty_level is not None else 1
        earned_points = difficulty * 10 * modifier
        
        current_user.system_points = (current_user.system_points or 0) + earned_points
        current_user.problems_solved = (current_user.problems_solved or 0) + 1
        
    # 7. пересчитать ранг (after problems_solved might be updated)
    current_user.rank_level = calculate_rank(new_player_rating, current_user.problems_solved)
    
    # --- Save attempt record ---
    new_attempt = TsumegoAttempt(
        player_id=current_user.id,
        problem_id=puzzle.id,
        attempt_number=attempt_number,
        is_correct=is_correct,
        used_hint=attempt_data.used_hint,
        time_spent_seconds=time_spent_seconds
    )
    
    db.add(new_attempt)
    db.commit()
    db.refresh(new_attempt)
    
    return {
        "status": "success", 
        "attempt_id": new_attempt.id, 
        "attempt_number": new_attempt.attempt_number,
        "earned_points": earned_points,
        "total_system_points": current_user.system_points,
        "rating_change": delta_player,
        "new_puzzle_rating": current_user.puzzle_rating,
        "new_rank": current_user.rank_level
    }

@router.post("/puzzles/{puzzle_id}/attempts")
def log_attempt(
    puzzle_id: str, 
    attempt_data: AttemptCreate, 
    db: Session = Depends(get_db), 
    current_user: User = Depends(get_current_user)
):
    puzzle = db.query(TsumegoPuzzle).filter(TsumegoPuzzle.id == puzzle_id).first()
    if not puzzle:
        raise HTTPException(status_code=404, detail="Puzzle not found")
        
    return process_problem_result(db, current_user, puzzle, attempt_data)

@router.get("/practice/next")
def get_next_practice_puzzle(
    collection_name: Optional[str] = None,
    goal_type: Optional[str] = None,
    current_id: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = db.query(TsumegoPuzzle)
    if collection_name:
        query = query.join(TsumegoCollection).filter(TsumegoCollection.name == collection_name)
    if goal_type:
        query = query.filter(TsumegoPuzzle.goal_type == goal_type)
        
    puzzles = query.all()
    if not puzzles:
        raise HTTPException(status_code=404, detail="No puzzles found for the given criteria.")
        
    user_progress_map = {}
    attempts = db.query(TsumegoAttempt).filter(TsumegoAttempt.player_id == current_user.id).order_by(TsumegoAttempt.created_at.asc()).all()
    
    for att in attempts:
        if att.problem_id not in user_progress_map:
            user_progress_map[att.problem_id] = {"status": "unattempted", "failed_count": 0}
            
        prev = user_progress_map[att.problem_id]
        current_status = prev["status"]
        
        if att.is_correct:
            if att.used_hint:
                user_progress_map[att.problem_id]["status"] = "passed_with_hint"
            elif current_status != "passed_with_hint":
                if prev["failed_count"] > 0 or current_status == "passed_with_errors":
                    user_progress_map[att.problem_id]["status"] = "passed_with_errors"
                else:
                    user_progress_map[att.problem_id]["status"] = "passed_clean"
        else:
            user_progress_map[att.problem_id]["failed_count"] += 1
            if current_status == "unattempted":
                user_progress_map[att.problem_id]["status"] = "failed"
            elif current_status == "passed_clean":
                user_progress_map[att.problem_id]["status"] = "passed_with_errors"
                
    if not current_id:
        for att in reversed(attempts):
            puzzle_state = user_progress_map.get(att.problem_id, {}).get("status")
            if puzzle_state in ["passed_with_errors", "failed"]:
                if any(p.id == att.problem_id for p in puzzles):
                    return {"next_puzzle_id": att.problem_id}
                    
    eligible_puzzles = []
    all_puzzles_ids = []
    
    for p in puzzles:
        if current_id and p.id == current_id:
            continue
            
        all_puzzles_ids.append(p.id)
        
        status = user_progress_map.get(p.id, {}).get("status", "unattempted")
        if status != "passed_clean":
            eligible_puzzles.append(p.id)
            
    import random
    if eligible_puzzles:
        return {"next_puzzle_id": random.choice(eligible_puzzles)}
        
    if all_puzzles_ids:
        return {"next_puzzle_id": random.choice(all_puzzles_ids)}
        
    return {"next_puzzle_id": puzzles[0].id}

@router.get("/puzzles/{puzzle_id}")
def get_puzzle(puzzle_id: str, db: Session = Depends(get_db), current_user: Optional[User] = Depends(get_current_user_optional)):
    puzzle = db.query(TsumegoPuzzle).filter(TsumegoPuzzle.id == puzzle_id).first()
    if not puzzle:
        raise HTTPException(status_code=404, detail="Puzzle not found")
        
    return {
        "id": puzzle.id,
        "source_key": puzzle.source_key,
        "board_width": puzzle.board_width,
        "board_height": puzzle.board_height,
        "to_play": puzzle.to_play,
        "goal_type": puzzle.goal_type,
        "difficulty_source": puzzle.difficulty_source,
        "title": puzzle.title,
        "board_position": puzzle.board_position,
        "solution": puzzle.solution,
        "difficulty_level": puzzle.difficulty_level,
        "difficulty_rank": puzzle.difficulty_rank,
        "difficulty_relation": compare_levels(current_user.puzzle_rating, puzzle.problem_rating or 100) if current_user else "UNKNOWN",
        "tags": [t.name for t in getattr(puzzle, 'tags', [])],
        "collection_name": puzzle.collection.name if puzzle.collection else None,
        "normalized_json": puzzle.normalized_json
    }
