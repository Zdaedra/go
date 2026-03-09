import json
import subprocess
import os
import requests

KATAGO_BINARY = os.getenv("KATAGO_BINARY", "katago")
KATAGO_NETWORK = os.getenv("KATAGO_NETWORK", "/opt/katago/network.bin.gz")
# Using a standard 18b model from official training site
NETWORK_URL = "https://media.katagotraining.org/uploaded/networks/models/kata1/kata1-b18c384nbt-s9996604416-d4316597426.bin.gz"

def ensure_network_downloaded():
    if not os.path.exists(KATAGO_NETWORK) or os.path.getsize(KATAGO_NETWORK) < 1000:
        print(f"Downloading KataGo network from {NETWORK_URL}...")
        os.makedirs(os.path.dirname(KATAGO_NETWORK), exist_ok=True)
        # Using a comprehensive bot-like user agent
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1',
            'Sec-Fetch-Dest': 'document',
            'Sec-Fetch-Mode': 'navigate',
            'Sec-Fetch-Site': 'none',
            'Sec-Fetch-User': '?1',
        }
        with requests.get(NETWORK_URL, headers=headers, stream=True) as r:
            r.raise_for_status()
            with open(KATAGO_NETWORK, 'wb') as f:
                for chunk in r.iter_content(chunk_size=8192):
                    f.write(chunk)
        print("Download complete.")

def _run_katago_queries(queries):
    config_file = os.environ.get("KATAGO_CONFIG", "/opt/katago/analysis_example.cfg")
    if not os.path.exists(config_file):
        config_file = "/opt/katago/analysis_example.cfg"
        
    cmd = [
        KATAGO_BINARY, "analysis",
        "-model", KATAGO_NETWORK,
        "-config", config_file
    ]


    proc = subprocess.Popen(cmd, stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    for q in queries:
        proc.stdin.write(json.dumps(q) + "\n")
    proc.stdin.close()
    
    results = {}
    while True:
        line = proc.stdout.readline()
        if not line: break
        try:
            resp = json.loads(line)
            if "id" in resp: results[resp["id"]] = resp
        except json.JSONDecodeError: pass
    proc.wait()
    
    print(f"DEBUG: Katago Command ran: {cmd}")
    print(f"DEBUG: Katago Stderr: {proc.stderr.read()}")
    
    return results

def analyze_sgf_with_katago(sgf_content: bytes):
    ensure_network_downloaded()
    from sgfmill import sgf
    
    try:
        game = sgf.Sgf_game.from_bytes(sgf_content)
    except Exception as e:
        print(f"Error parsing SGF: {e}")
        return [], []
        
    board_size = game.get_size()
    moves = []
    node = game.get_root()
    color_map = {'b': 'B', 'w': 'W'}
    
    while True:
        try:
            node = node[0]
        except IndexError:
            break
        color, move = node.get_move()
        if color and move:
            row, col = move
            gtp_col = chr(ord('A') + col)
            if gtp_col >= 'I': gtp_col = chr(ord(gtp_col) + 1)
            gtp_row = str(row + 1)
            moves.append((color_map[color], f"{gtp_col}{gtp_row}"))
            
    # PASS 1: Fast Pass
    fast_visits = int(os.environ.get("ANALYSIS_VISITS_PASS1", 300))
    pass1_queries = []
    current_moves = []
    
    for i in range(len(moves) + 1):
        pass1_queries.append({
            "id": f"q_{i}",
            "moves": current_moves[:],
            "rules": "chinese",
            "boardXSize": board_size,
            "boardYSize": board_size,
            "maxVisits": fast_visits,
            "analysisPVLen": 15
        })
        if i < len(moves):
            current_moves.append(moves[i])

    print(f"Running Pass 1 ({fast_visits} visits) on {len(pass1_queries)} positions...")
    r1 = _run_katago_queries(pass1_queries)
    
    # Calculate swings
    swings = []
    prev_black_score = 0
    for i in range(len(moves) + 1):
        if f"q_{i}" in r1 and "rootInfo" in r1[f"q_{i}"]:
            raw_scoreLead = r1[f"q_{i}"]["rootInfo"].get("scoreLead", 0)
            
            # i represents the board state AFTER moves[0...i-1] have been played.
            # So moves[i-1] is the move that just happened.
            color = moves[i-1][0] if i > 0 else None
            
            # Determine whose turn it is now (at state i).
            # If the last move was 'B', it is normally 'W's turn now.
            # KataGo's scoreLead is from the perspective of the player CURRENTLY to move.
            is_black_turn = (color == 'W' or i == 0) if color else True
            # Let's ensure it maps strictly from the moves list payload to handle consecutive same-color moves in SGFs (like passes/handicaps)
            if i < len(moves):
                is_black_turn = (moves[i][0] == 'B')
            
            black_scoreLead = raw_scoreLead if is_black_turn else -raw_scoreLead
            
            delta = 0 # Positive delta means the player who just moved GAINED points. Negative means they LOST points (mistake).
            if i > 0:
                diff = black_scoreLead - prev_black_score
                delta = diff if color == 'B' else -diff
            swings.append((i, delta))
            prev_black_score = black_scoreLead

    # Pick top N candidate scenes (e.g. top 8 worst mistakes: most negative delta)
    # Also include strong moves (most positive delta)
    top_mistakes = sorted(swings, key=lambda x: x[1])[:8] # lowest delta (most negative)
    top_strong = sorted(swings, key=lambda x: x[1], reverse=True)[:8] # highest delta
    candidate_turns = {c[0] for c in top_mistakes + top_strong}
    
    # PASS 2: Deep Pass
    deep_visits = int(os.environ.get("ANALYSIS_VISITS_PASS2", 1600))
    pass2_queries = []
    current_moves = []
    
    for i in range(len(moves) + 1):
        if i in candidate_turns:
            pass2_queries.append({
                "id": f"qdeep_{i}",
                "moves": current_moves[:],
                "rules": "chinese",
                "boardXSize": board_size,
                "boardYSize": board_size,
                "maxVisits": deep_visits,
                "analysisPVLen": 15
            })
        if i < len(moves):
            current_moves.append(moves[i])
            
    print(f"Running Pass 2 ({deep_visits} visits) on {len(pass2_queries)} candidate positions...")
    r2 = _run_katago_queries(pass2_queries)
    
    # Format final enriched results
    analysis_data = []
    prev_scoreLead = 0
    
    for i in range(len(moves) + 1):
        fast_res = r1.get(f"q_{i}", {})
        deep_res = r2.get(f"qdeep_{i}", fast_res) # Use deep if available, fallback to fast
        
        if "rootInfo" in fast_res:
            raw_scoreLead = fast_res["rootInfo"].get("scoreLead", 0)
            winrate = fast_res["rootInfo"].get("winrate", 0)
            
            color = moves[i-1][0] if i > 0 else None
            actual_move = moves[i-1][1] if i > 0 else None
            
            is_black_turn = (color == 'W' or i == 0) if color else True
            if i < len(moves):
                is_black_turn = (moves[i][0] == 'B')
                
            black_scoreLead = raw_scoreLead if is_black_turn else -raw_scoreLead
            
            delta = 0
            if i > 0:
                diff = black_scoreLead - prev_scoreLead
                delta = diff if color == 'B' else -diff
                
            prev_scoreLead = black_scoreLead
            
            if i in candidate_turns and "rootInfo" in deep_res:
                scoreLead = deep_res["rootInfo"].get("scoreLead", 0)
                winrate = deep_res["rootInfo"].get("winrate", 0)
                best_moves = []
                best_pv = []
                if "moveInfos" in deep_res:
                    sorted_infos = sorted(deep_res["moveInfos"], key=lambda k: k.get("order", 999))
                    # Extract up to top 3 scenarios
                    top_infos = sorted_infos[:3]
                    best_moves = [info["move"] for info in top_infos]
                    
                    # Store up to 3 PVs, limited to 10 moves deep each
                    best_pv = []
                    for info in top_infos:
                        pv = info.get("pv", [])[:10]
                        # Only keep sequences that are at least 3 moves long to prevent LLM from making 1 move summaries
                        if pv and len(pv) >= 3:
                            best_pv.append(pv)
                
                analysis_data.append({
                    "turn": i,
                    "color": color,
                    "actual_move": actual_move,
                    "best_moves": best_moves,
                    "best_pv": best_pv, # Now a list of lists (up to 3 sequences, each >= 3 moves)
                    "scoreLead": scoreLead,
                    "winrate": winrate,
                    "delta": delta
                })

    return analysis_data, moves
