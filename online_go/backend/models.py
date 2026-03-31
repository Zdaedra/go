from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel

class Player(BaseModel):
    user_id: str
    rank: str

class GameModel(BaseModel):
    gameID: str
    players: List[Player]
    status: str
    rank: str
    speed: str
    startTime: datetime
    endTime: Optional[datetime] = None