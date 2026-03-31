import requests
from typing import List, Dict, Any
from .connector import BaseSourceConnector, NormalizedPuzzle, NormalizedBoard

def _parse_ogs_stones(stone_str: str) -> List[List[int]]:
    if not stone_str or not isinstance(stone_str, str):
        return []
    res = []
    # OGS coordinates use 'a'=0, 'b'=1, etc. First char is x (col), second is y (row).
    # SGF standard: top-left is aa
    for i in range(0, len(stone_str), 2):
        if i + 1 < len(stone_str):
            col = ord(stone_str[i]) - ord('a')
            row = ord(stone_str[i+1]) - ord('a')
            # Keeping as list so JSON serialization handles it simply
            res.append([row, col])
    return res

class OGSConnector(BaseSourceConnector):
    def __init__(self):
        super().__init__(source_key="ogs", base_url="https://online-go.com/api/v1")

    def list_collections(self) -> List[Dict[str, str]]:
        # OGS doesn't have a simple "list all collections" endpoint without heavy scraping/crawling.
        # For MVP, we can configure specific collection IDs to track, or search public ones.
        return [{"id": "1", "name": "OGS Default Collection (Demo)"}]

    def list_puzzles(self, collection_id: str) -> List[str]:
        # Fetch the puzzles for a given collection, paginated. Let's fetch the first 100 for volume.
        puzzle_ids = []
        url = f"{self.base_url}/puzzles/?collection={collection_id}"
        
        while url and len(puzzle_ids) < 100:
            response = requests.get(url)
            if response.status_code == 200:
                data = response.json()
                for p in data.get("results", []):
                    puzzle_ids.append(str(p["id"]))
                url = data.get("next")
            else:
                break
                
        return puzzle_ids

    def fetch_puzzle(self, puzzle_id: str) -> NormalizedPuzzle:
        url = f"{self.base_url}/puzzles/{puzzle_id}"
        response = requests.get(url)
        if response.status_code != 200:
            raise ValueError(f"Failed to fetch puzzle {puzzle_id} from OGS")
        
        data = response.json()
        puzzle_name = data.get("name", f"Puzzle {puzzle_id}")
        width = data.get("width", 19)
        height = data.get("height", 19)
        initial_player = data.get("initial_player", "black")
        
        to_play = "B" if initial_player == "black" else "W"
        
        # OGS initial_state sits inside the 'puzzle' object
        puzzle_data = data.get("puzzle", {})
        initial_state = puzzle_data.get("initial_state", {})
        
        black_stones = []
        white_stones = []
        
        if isinstance(initial_state, dict):
            black_stones = _parse_ogs_stones(initial_state.get("black", ""))
            white_stones = _parse_ogs_stones(initial_state.get("white", ""))
        
        board = NormalizedBoard(
            width=width,
            height=height,
            to_play=to_play,
            stones={"B": black_stones, "W": white_stones}
        )
        
        return NormalizedPuzzle(
            source_puzzle_id=str(puzzle_id),
            source_url=f"https://online-go.com/puzzle/{puzzle_id}",
            board=board,
            goal_type="life_and_death", # Default assumption
            raw_payload=data
        )

    def determine_license(self, puzzle: NormalizedPuzzle) -> str:
        # Default policy for OGS per instructions
        return "per-item-unknown"
