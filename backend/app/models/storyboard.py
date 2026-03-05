from typing import List, Literal, Optional, Dict, Any
from pydantic import BaseModel, Field, conlist

Coord = str  # "A1".."I9"
Color = Literal["B", "W"]

class Action(BaseModel):
    type: Literal[
        "jump", "rewind", "forward", "clearOverlays",
        "highlight", "mark", "label", "arrow", "region",
        "showBestMove", "showSequence",
        "spotlight", "clearSpotlight", "setCompareKey"
    ]
    # For jump, rewind, forward
    move: Optional[int] = None
    
    # For highlight
    stones: Optional[List[Coord]] = None
    
    # For mark, label, showBestMove
    at: Optional[Coord] = None
    shape: Optional[Literal["circle", "square", "triangle", "x"]] = None
    text: Optional[str] = None
    
    # For arrow
    from_: Optional[Coord] = Field(None, alias="from")
    to: Optional[Coord] = None
    
    # For arrow, region
    label: Optional[str] = None
    
    # For region
    points: Optional[List[Coord]] = None
    
    # For showSequence
    moves: Optional[List[Coord]] = None
    mode: Optional[Literal["ghost", "step"]] = None
    speedSecPerMove: Optional[float] = None
    asColor: Optional[Color] = None
    
    # For spotlight
    dimOpacity: Optional[float] = None
    bbox: Optional[Dict[str, Coord]] = None  # Expected {"from": Coord, "to": Coord}
    
    # For setCompareKey
    key: Optional[Literal["bad", "good", "neutral"]] = None
    
    class Config:
        populate_by_name = True

class StepAudio(BaseModel):
    url: str
    durationSec: Optional[float] = None

class StoryStep(BaseModel):
    id: str
    say: str
    audio: Optional[StepAudio] = None
    actions: List[Action] = Field(default_factory=list)
    mode: Optional[Literal["stopframe", "candidates", "yourmove", "demo_bad", "demo_good", "consequence", "takeaway"]] = None
    overlayPresetKey: Optional[Literal["bad", "good", "neutral"]] = None

class Moment(BaseModel):
    moment_id: str
    type: Literal["mistake", "strong"]
    move_number: int
    player: Color
    title: str
    impact: float
    preview: str
    jumpMove: int
    teachingGoal: Optional[str] = None
    teachingPackSummary: Optional[Dict[str, Any]] = None
    steps: conlist(StoryStep, min_length=1)

class EngineMeta(BaseModel):
    name: str = "KataGo"
    visitsPass1: int
    visitsPass2: int

class Players(BaseModel):
    black: str = "Black"
    white: str = "White"

class StoryMeta(BaseModel):
    gameId: str
    boardSize: int = 9
    komi: float = 0
    players: Players = Players()
    userColor: Color = "B"
    assets: Dict[str, str]

class Storyboard(BaseModel):
    meta: StoryMeta
    moment: Optional[Moment] = None # When detailing a single moment API
    moments: Optional[List[Moment]] = None # When listing all moments API
