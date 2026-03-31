from pydantic import BaseModel
from typing import Optional, Dict

class GameModel(BaseModel):
    gameID: str
    players: Dict[str, str]
    status: str
    rank: str
    speed: str
    startTime: str
    endTime: Optional[str]

class LearningContentModel(BaseModel):
    contentID: str
    title: str
    type: str
    difficulty: str
    author: str
    publishDate: str