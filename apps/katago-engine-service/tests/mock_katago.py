import sys
import json
import time

def run():
    sys.stderr.write("KataGo v1.14.0 Mock Engine Started\n")
    sys.stderr.flush()
    while True:
        line = sys.stdin.readline()
        if not line:
            break
        try:
            query = json.loads(line)
        except:
            continue
            
        req_id = query.get("id")
        
        # Determine rules and board
        bx = query.get("boardXSize", 19)
        by = query.get("boardYSize", 19)
        
        # Handle time limits
        if "timeout" in req_id:
            time.sleep(10)
        else:
            time.sleep(0.01)
            
        moves = query.get("moves", [])
        if "illegal" in str(moves).lower():
            err_resp = {"id": req_id, "error": "Illegal move requested"}
            sys.stdout.write(json.dumps(err_resp) + "\n")
            sys.stdout.flush()
            continue

        resp = {
            "id": req_id,
            "rootInfo": {"winrate": 0.55, "scoreLead": 1.2, "visits": query.get("maxVisits", 10), "currentPlayer": "B"},
            "moveInfos": [
                {"move": "D4", "order": 0, "winrate": 0.55, "scoreLead": 1.2, "lcb": 0.54, "prior": 0.1, "visits": 10}
            ],
            "ownership": [0.0] * (bx * by) if query.get("includeOwnership") else []
        }
        
        sys.stdout.write(json.dumps(resp) + "\n")
        sys.stdout.flush()

if __name__ == "__main__":
    run()
