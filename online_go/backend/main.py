from fastapi import FastAPI
from datetime import datetime
from .models import GameModel, Player
from typing import List

app = FastAPI()

@app.get("/games", response_model=List[GameModel])
async def get_games():
    # Mock data for demonstration purposes
    games = [
        GameModel(
            gameID="game_001",
            players=[
                Player(user_id="user_001", rank="5k"),
                Player(user_id="user_002", rank="5k")
            ],
            status="live",
            rank="5k",
            speed="blitz",
            startTime=datetime.now()
        ),
        GameModel(
            gameID="game_002",
            players=[
                Player(user_id="user_003", rank="3k"),
                Player(user_id="user_004", rank="3k")
            ],
            status="finished",
            rank="3k",
            speed="normal",
            startTime=datetime.now(),
            endTime=datetime.now()
        ),
    ]
    return games