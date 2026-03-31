from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional
import os
import json
import traceback
import httpx
import asyncio
from openai import AsyncOpenAI

router = APIRouter(prefix="/v1/ai", tags=["ai_tutor"])

# Load OpenAI Client
openai_client = AsyncOpenAI(api_key=os.getenv("OPENAI_API_KEY"))

# Local KataGo CPU Endpoint (Routes back through Celery native orchestrator)
LOCAL_ENDPOINT = "http://localhost:8000/v1/games/analyze/stateless"

class GenerateScenarioRequest(BaseModel):
    state_before: dict
    played_move: str
    optimal_moves: List[dict]

import random

def parse_coord(coord):
    if not coord or coord == "PASS": return -1, -1
    cols = "ABCDEFGHJKLMNOPQRSTUVWXYZ"
    col_char = coord[0].upper()
    try:
        x = cols.index(col_char)
        y = int(coord[1:]) - 1
        return x, y
    except:
        return -1, -1

def to_coord(x, y):
    cols = "ABCDEFGHJKLMNOPQRSTUVWXYZ"
    if x < 0 or x >= len(cols) or y < 0:
        return "PASS"
    return f"{cols[x]}{y + 1}"

def rotate_point(coord, size, degrees):
    x, y = parse_coord(coord)
    if x == -1: return "PASS"
    cx = (size - 1) / 2.0
    cy = (size - 1) / 2.0
    rx = x - cx
    ry = y - cy
    if degrees == 90:
        nx, ny = -ry, rx
    elif degrees == 180:
        nx, ny = -rx, -ry
    elif degrees == 270:
        nx, ny = ry, -rx
    else:
        nx, ny = rx, ry
    return to_coord(int(nx + cx), int(ny + cy))

@router.post("/generate_scenario")
async def generate_scenario(req: GenerateScenarioRequest):
    """
    Takes a mathematical blunder and programmatically rotates the local stone geometry to synthesize a novel Tsumego setup.
    Delegates the conceptual pedagogical text mapping back to GPT-4o natively.
    """
    
    optimal_top = req.optimal_moves[0].get("move") if req.optimal_moves else "PASS"
    if optimal_top == "PASS":
        return {"status": "error", "message": "Optimal move was PASS, cannot synthesize geometry."}

    board_size = req.state_before.get('board_size', 19)
    raw_b = req.state_before.get('black_stones', [])
    raw_w = req.state_before.get('white_stones', [])
    to_play = req.state_before.get('to_play', 'B')
    
    ox, oy = parse_coord(optimal_top)
    
    # Scale core extraction dynamically (radius 3 for 9x9, radius 4 for 13x13, radius 5 for 19x19)
    # The max distance an 8-way Manhattan ray can travel before clipping the core fight.
    radius = min(5, max(3, board_size // 3 - 1 if board_size < 19 else 5))
    
    # Extract only the local cluster geometry
    core_b = [s for s in raw_b if max(abs(parse_coord(s)[0]-ox), abs(parse_coord(s)[1]-oy)) <= radius]
    core_w = [s for s in raw_w if max(abs(parse_coord(s)[0]-ox), abs(parse_coord(s)[1]-oy)) <= radius]
    
    generated_b = []
    generated_w = []
    rotated_optimal = ""
    success_hints = []
    
    # Fast programmatic generation validation loop
    for attempt in range(1, 15):
        deg = random.choice([90, 180, 270])
        
        rot_b = [rotate_point(s, board_size, deg) for s in core_b]
        rot_w = [rotate_point(s, board_size, deg) for s in core_w]
        
        # Scaffold random topological garbage harmlessly in the outer periphery
        occupied = set(rot_b + rot_w)
        rox, roy = parse_coord(rotate_point(optimal_top, board_size, deg))
        
        garbage_stones = []
        # Less garbage on smaller boards
        garbage_count = random.randint(2, 4) if board_size <= 9 else random.randint(4, 9)
        
        for _ in range(garbage_count):
            for __ in range(20):
                gx = random.randint(0, board_size - 1)
                gy = random.randint(0, board_size - 1)
                g_coord = to_coord(gx, gy)
                
                # Check for empty intersection.
                # Since 'radius' is scaled down for 9x9, finding a point greater than radius/2 is mathematically valid.
                dist = max(abs(gx - rox), abs(gy - roy))
                if g_coord not in occupied and dist > (radius // 2):
                    garbage_stones.append(g_coord)
                    occupied.add(g_coord)
                    break
                    
        # Filter garbage randomly between B and W cleanly
        gb = [s for i, s in enumerate(garbage_stones) if i % 2 == 0]
        gw = [s for i, s in enumerate(garbage_stones) if i % 2 != 0]
        
        test_b = rot_b + gb
        test_w = rot_w + gw
        
        validation_payload = {
            "ruleset": req.state_before.get("ruleset", "japanese"),
            "komi": req.state_before.get("komi", 6.5),
            "board_size": board_size,
            "black_stones": test_b,
            "white_stones": test_w,
            "to_play": to_play,
            "bot_id": "analyzer",
            "visits": 100
        }
        
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                katago_res = await client.post(LOCAL_ENDPOINT, json=validation_payload)
                katago_res.raise_for_status()
                k_data = katago_res.json()
        except:
            continue
            
        hints = k_data.get("result", {}).get("result", {}).get("hints", [])
        if not hints: continue
        
        # Validate that the garbage didn't mathematically destroy the puzzle logic globally
        target_optimal = rotate_point(optimal_top, board_size, deg)
        top_wr = hints[0].get("winrate", 0)
        
        valid = False
        for h in hints:
            if h.get("move") == target_optimal:
                if (top_wr - h.get("winrate", 0)) < 0.05:
                    valid = True
                break
                
        if valid:
            generated_b = test_b
            generated_w = test_w
            rotated_optimal = target_optimal
            success_hints = hints
            print(f"[AI Tutor] Clean Mathematical Rotation Success on array generation {attempt}!")
            break
            
    if not rotated_optimal:
        return {"status": "error", "message": "KataGo rejected the programmatic rotation configuration due to global physics breaking. Try again."}
        
    # Isolate LLM usage exclusively to processing text
    prompt = f"""
    You are a professional Go (Baduk) instructor.
    A student made a mistake in their game.
    They played {req.played_move}. The correct move was {optimal_top}.
    
    Please explain briefly (1-2 sentences) WHAT conceptually the student missed (e.g., missed a snapback, ignored a cutting point, played in the wrong direction). Keep it strictly focused on the tactical/strategic lesson, do NOT refer to specific board coordinates because the puzzle has been visually rotated for testing.
    """
    
    concept_text = "Analyze your tactical boundaries carefully."
    if os.getenv("OPENAI_API_KEY"):
        try:
            response = await openai_client.chat.completions.create(
                model="gpt-4o",
                messages=[{"role": "user", "content": prompt}],
                temperature=0.7
            )
            concept_text = response.choices[0].message.content.strip()
        except Exception as e:
            print("[AI Tutor] LLM Text Error:", e)

    puzzle_data = {
        "concept_explanation": concept_text,
        "board_size": board_size,
        "black_stones": generated_b,
        "white_stones": generated_w,
        "to_play": to_play,
        "optimal_move": rotated_optimal,
        "optimal_moves": success_hints,
        "state_before": {
            "board_size": board_size,
            "black_stones": generated_b,
            "white_stones": generated_w,
            "to_play": to_play,
            "ruleset": req.state_before.get("ruleset", "japanese")
        }
    }
    
    import pprint
    print(f"\n==== AI TUTOR GENERATED PUZZLE OUTPUT ====\n" + pprint.pformat(puzzle_data) + "\n=========================================\n", flush=True)
    
    return {
        "status": "success",
        "scenario": puzzle_data
    }
