import asyncio
from sqlalchemy.orm import Session
from database import get_db
import models
from utils_rating import calculate_match_rating_change, calculate_rank

def verify_rating_update():
    db = next(get_db())
    
    # Get two users to test with
    users = db.query(models.User).limit(2).all()
    if len(users) < 2:
        print("Not enough users to simulate a match.")
        return
        
    black_user = users[0]
    white_user = users[1]
    
    print(f"Before Match - Black ({black_user.username}): {black_user.rating} Elo")
    print(f"Before Match - White ({white_user.username}): {white_user.rating} Elo")
    
    # Simulate Black won
    black_won = True
    
    black_delta = calculate_match_rating_change(black_user.rating, white_user.rating, black_won)
    white_delta = calculate_match_rating_change(white_user.rating, black_user.rating, not black_won)
    
    print(f"Calculated Delta: Black: {black_delta}, White: {white_delta}")
    
    black_user.rating += black_delta
    white_user.rating += white_delta
    
    black_user.rank = calculate_rank(black_user.rating, 5)
    white_user.rank = calculate_rank(white_user.rating, 5)
    
    db.add(models.GameResult(
        user_id=black_user.id,
        match_type="pvp",
        points_change=black_delta,
        new_rating=black_user.rating
    ))
    
    db.add(models.GameResult(
        user_id=white_user.id,
        match_type="pvp",
        points_change=white_delta,
        new_rating=white_user.rating
    ))
    
    db.commit()
    
    print(f"After Match - Black ({black_user.username}): {black_user.rating} Elo")
    print(f"After Match - White ({white_user.username}): {white_user.rating} Elo")
    print("Simulation complete. GameResult entries created.")

if __name__ == "__main__":
    verify_rating_update()
