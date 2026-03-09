import os
import sys
import json
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("Diagnostics")

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from katago_runner import _run_katago_queries, ensure_network_downloaded
from llm_storyboard import generate_storyboard

def test_katago_direct():
    logger.info("--- Testing KataGo Direct Query ---")
    ensure_network_downloaded()
    query = {
        "id": "test_q",
        "moves": [["B", "E5"], ["W", "G5"], ["B", "E7"], ["W", "G7"], ["B", "C7"]],
        "rules": "chinese",
        "boardXSize": 9,
        "boardYSize": 9,
        "maxVisits": 1600,
        "analysisPVLen": 15
    }
    logger.info(f"Querying KataGo with: {json.dumps(query)}")
    try:
        results = _run_katago_queries([query])
        res = results.get("test_q", {})
        if "moveInfos" in res:
            infos = sorted(res["moveInfos"], key=lambda k: k.get("order", 999))
            logger.info(f"Found {len(infos)} move candidates.")
            for i, info in enumerate(infos[:3]):
                pv = info.get("pv", [])
                logger.info(f"Candidate {i+1} move: {info.get('move')}, PV Length: {len(pv)}, PV: {pv}")
        else:
            logger.error(f"No moveInfos returned! Raw result: {res}")
        
        # Now let's test the LLM part
        analysis_data = [{
            "turn": 6,
            "color": "W",
            "actual_move": "D4",
            "best_moves": ["C4"],
            "best_pv": [["C4", "C3", "B4", "D3", "E3"]],
            "scoreLead": -5.5,
            "winrate": 0.2,
            "delta": -6.0
        }]
        
        logger.info("--- Testing LLM Generation ---")
        try:
            storyboard = generate_storyboard(analysis_data, "test_game")
            logger.info("LLM Output generated successfully. Checking for showSequence...")
            for moment in storyboard.get("moments", []):
                for step in moment.get("steps", []):
                    for action in step.get("actions", []):
                        if action.get("type") == "showSequence":
                            logger.info(f"LLM generated showSequence: {action.get('moves')} for step saying: {step.get('say')}")
        except Exception as e:
            logger.error(f"Error calling LLM: {e}")
            
    except Exception as e:
        logger.error(f"Error running Katago: {e}")

if __name__ == "__main__":
    logger.info("Starting Diagnostics")
    logger.info("Ensure you are running this inside the docker container so Katago is available.")
    test_katago_direct()
    logger.info("Done.")
