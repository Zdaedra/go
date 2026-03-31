import asyncio
import json
import uuid
from typing import Dict, List, Optional
from fastapi import WebSocket

class MatchmakingManager:
    def __init__(self):
        self.waiting_players: List[dict] = []
        self.lock = asyncio.Lock()

    async def connect_and_match(self, user_id: str, rating: int, config: dict, websocket: WebSocket) -> Optional[dict]:
        """
        Add a user to the queue and instantly try to find a match based on Sprint 1 rules.
        """
        async with self.lock:
            # Remove old connection if user is already in queue
            self.waiting_players = [p for p in self.waiting_players if p['user_id'] != user_id]
            
            # Extract player config
            my_board_sizes = set(config.get("board_sizes", [19]))
            my_ruleset = config.get("ruleset", "japanese")
            my_ranked = config.get("ranked", True)
            my_handicap = config.get("handicap", "auto")
            my_time_control = config.get("time_control", {"mode": "rapid"})
            
            matched_player = None
            board_size = 19
            
            for p in self.waiting_players:
                # Must not match self (already removed but just to be safe)
                if p['user_id'] == user_id:
                    continue
                    
                # 1. Match Ranked state
                if p['config'].get("ranked", True) != my_ranked:
                    continue
                    
                # 2. Check Board Size Intersection
                their_sizes = set(p['config'].get("board_sizes", [19]))
                common_sizes = my_board_sizes.intersection(their_sizes)
                if not common_sizes:
                    continue
                board_size = sorted(list(common_sizes), reverse=True)[0] # pick largest common
                
                # 3. Check Ruleset (only strict for ranked)
                if my_ranked and p['config'].get("ruleset", "japanese") != my_ruleset:
                    continue
                    
                # 4. Check Rank range if ranked
                if my_ranked:
                    # simplified 1 rank = 100 rating diff. Max 9 ranks = 900
                    if abs(p['rating'] - rating) > 900:
                        continue
                        
                matched_player = p
                break
            
            if matched_player:
                self.waiting_players.remove(matched_player)
                
                return {
                    "player1": {"user_id": user_id, "websocket": websocket, "color": "B", "rating": rating},
                    "player2": {"user_id": matched_player["user_id"], "websocket": matched_player["websocket"], "color": "W", "rating": matched_player["rating"]},
                    "board_size": board_size,
                    "ruleset": my_ruleset if my_ranked else config.get("ruleset", "japanese"),
                    "time_control": my_time_control, # Simplified MVP: take searcher's time control
                    "handicap": my_handicap,
                    "ranked": my_ranked
                }
            
            # No match found, add to queue
            self.waiting_players.append({
                "user_id": user_id,
                "rating": rating,
                "websocket": websocket,
                "config": config
            })
            return None

    async def disconnect(self, user_id: str):
        """Remove user from queue if they disconnect while waiting."""
        async with self.lock:
            self.waiting_players = [p for p in self.waiting_players if p['user_id'] != user_id]

matchmaker = MatchmakingManager()
