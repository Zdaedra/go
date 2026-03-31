from abc import ABC, abstractmethod
from typing import List, Dict, Optional, Any
from pydantic import BaseModel
import hashlib
import json

class NormalizedBoard(BaseModel):
    width: int
    height: int
    to_play: str  # 'B' or 'W'
    stones: Dict[str, List[List[int]]]

class NormalizedPuzzle(BaseModel):
    source_puzzle_id: str
    source_url: str
    board: NormalizedBoard
    goal_type: Optional[str] = None
    difficulty: Optional[str] = None
    raw_payload: Any
    tags: List[str] = []

class BaseSourceConnector(ABC):
    def __init__(self, source_key: str, base_url: str):
        self.source_key = source_key
        self.base_url = base_url

    @abstractmethod
    def list_collections(self) -> List[Dict[str, str]]:
        pass

    @abstractmethod
    def list_puzzles(self, collection_id: str) -> List[str]:
        pass

    @abstractmethod
    def fetch_puzzle(self, puzzle_id: str) -> NormalizedPuzzle:
        pass

    def compute_position_hash(self, board: NormalizedBoard) -> str:
        # Convert lists of lists to tuples so they are sortable and hashable properly
        black_stones = sorted([tuple(s) for s in board.stones.get("B", [])])
        white_stones = sorted([tuple(s) for s in board.stones.get("W", [])])
        canonical_dict = {
            "s": f"{board.width}x{board.height}",
            "p": board.to_play,
            "b": black_stones,
            "w": white_stones
        }
        canonical_str = json.dumps(canonical_dict, sort_keys=True)
        return hashlib.sha256(canonical_str.encode('utf-8')).hexdigest()

    def determine_license(self, puzzle: NormalizedPuzzle) -> str:
        return None
