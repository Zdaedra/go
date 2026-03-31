import json
import logging
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends
from sqlalchemy.orm import Session
from database import get_db
import models
from jose import jwt, JWTError
from security import SECRET_KEY, ALGORITHM
from matchmaking import matchmaker
from game_manager import game_manager
from utils_rating import calculate_match_rating_change, calculate_rank

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/v1/ws", tags=["sockets"])

def get_ws_user(token: str, db: Session):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
        if user_id is None:
            return None
        return db.query(models.User).filter(models.User.id == user_id).first()
    except JWTError:
        return None

@router.websocket("/queue")
async def websocket_queue(websocket: WebSocket, token: str, config: str = "{}", db: Session = Depends(get_db)):
    user = get_ws_user(token, db)
    if not user:
        await websocket.close(code=1008)
        return
        
    await websocket.accept()
    
    try:
        try:
            config_dict = json.loads(config)
        except Exception:
            config_dict = {
                "board_sizes": [19],
                "ruleset": "japanese",
                "ranked": True,
                "handicap": "auto",
                "time_control": {"mode": "rapid"}
            }
            
        match_data = await matchmaker.connect_and_match(user.id, user.rating, config_dict, websocket)
        if match_data:
            # We have a match! 
            # 1. Create PlayerMatch in DB
            new_match = models.PlayerMatch(
                black_player_id=match_data["player1"]["user_id"] if match_data["player1"]["color"] == "B" else match_data["player2"]["user_id"],
                white_player_id=match_data["player2"]["user_id"] if match_data["player2"]["color"] == "W" else match_data["player1"]["user_id"],
                time_preset=match_data.get("time_control", {}).get("mode", "rapid"),
                board_size=match_data.get("board_size", 19),
                ruleset=match_data.get("ruleset", "japanese"),
                is_ranked=match_data.get("ranked", True),
                game_settings={
                    "handicap": match_data.get("handicap", "auto"),
                    "time_control": match_data.get("time_control", {})
                },
                status="active"
            )
            db.add(new_match)
            db.commit()
            db.refresh(new_match)
            
            match_id = str(new_match.id)
            
            # 2. Add game to game_manager memory
            game_manager.create_game(match_id, match_data.get("board_size", 19), match_data.get("time_control", {}).get("mode", "rapid"))
            
            # 3. Notify both players
            try:
                await match_data["player1"]["websocket"].send_text(json.dumps({
                    "type": "match_found",
                    "match_id": match_id,
                    "color": match_data["player1"]["color"]
                }))
            except: pass
            
            try:
                await match_data["player2"]["websocket"].send_text(json.dumps({
                    "type": "match_found",
                    "match_id": match_id,
                    "color": match_data["player2"]["color"]
                }))
            except: pass
            
            # Disconnect them from queue
            try: await match_data["player1"]["websocket"].close()
            except: pass
            try: await match_data["player2"]["websocket"].close()
            except: pass
            return
            
        # Waiting loop
        while True:
            await websocket.receive_text() # keepalive ping
    except WebSocketDisconnect:
        await matchmaker.disconnect(user.id)

@router.websocket("/matches/{match_id}")
async def websocket_match(websocket: WebSocket, match_id: str, token: str, db: Session = Depends(get_db)):
    user = get_ws_user(token, db)
    if not user:
        await websocket.close(code=1008)
        return
        
    await websocket.accept()
    
    # Check if match exists and is active
    match_record = db.query(models.PlayerMatch).filter(models.PlayerMatch.id == int(match_id)).first()
    if not match_record or match_record.status != "active":
        await websocket.close(code=1000)
        return
        
    # Check if user is part of the match
    is_black = str(match_record.black_player_id) == str(user.id)
    is_white = str(match_record.white_player_id) == str(user.id)
    
    # If not a player, they are a spectator
    if not is_black and not is_white:
        player_color = 'spectator'
        opponent_id = None
    else:
        player_color = 'black' if is_black else 'white'
        opponent_id = match_record.white_player_id if is_black else match_record.black_player_id
    
    # Ensure game memory exists (in case server restarted while game was active)
    if match_id not in game_manager.active_games:
        game_manager.create_game(match_id, match_record.board_size, match_record.time_preset)
        
    # Register connection
    if player_color == 'spectator':
        game_manager.add_spectator(match_id, str(user.id), websocket)
    else:
        game_manager.add_player(match_id, str(user.id), websocket, player_color)
        
    session = game_manager.get_game(match_id)
    
    # Fetch player details for the UI
    black_user = db.query(models.User).filter(models.User.id == match_record.black_player_id).first()
    white_user = db.query(models.User).filter(models.User.id == match_record.white_player_id).first()
    
    async def process_game_over(reason_str):
        match_record.status = "finished"
        match_record.winner_id = opponent_id
        match_record.win_reason = reason_str
        
        if black_user and white_user:
            black_id = str(match_record.black_player_id)
            black_won = (opponent_id == black_id)
            
            black_delta = calculate_match_rating_change(black_user.rating, white_user.rating, black_won)
            white_delta = calculate_match_rating_change(white_user.rating, black_user.rating, not black_won)
            
            black_user.rating += black_delta
            white_user.rating += white_delta
            
            black_user.rank = calculate_rank(black_user.rating, 5)
            white_user.rank = calculate_rank(white_user.rating, 5)
            
            db.add(models.GameResult(user_id=black_user.id, match_type="pvp", points_change=black_delta, new_rating=black_user.rating))
            db.add(models.GameResult(user_id=white_user.id, match_type="pvp", points_change=white_delta, new_rating=white_user.rating))
        
        db.commit()
        
        event = {"type": "game_over", "reason": reason_str, "winner_color": "white" if is_black else "black"}
        for pid, ws in session["sockets"].items():
            await ws.send_text(json.dumps(event))
        for sid, ws in session["spectators"].items():
            try: await ws.send_text(json.dumps(event))
            except Exception: pass
    
    # Send initial game state with real usernames
    await websocket.send_text(json.dumps({
        "type": "game_start",
        "your_color": player_color,
        "black_player": {
            "id": black_user.id if black_user else "unknown",
            "username": black_user.username if black_user else "Player",
            "rating": black_user.rating if black_user else 500
        },
        "white_player": {
            "id": white_user.id if white_user else "unknown",
            "username": white_user.username if white_user else "Player",
            "rating": white_user.rating if white_user else 500
        },
        "board_size": match_record.board_size,
        "time_preset": match_record.time_preset,
        "timers": session["game"].timers,
        "board": session["game"].board,
        "captures": session["game"].captures,
        "current_player": session["game"].current_player
    }))
    
    try:
        while True:
            try:
                data = await websocket.receive_text()
                message = json.loads(data)
                
                if message.get("type") == "move":
                    if player_color == "spectator":
                        await websocket.send_text(json.dumps({"type": "error", "message": "Spectators cannot play moves"}))
                        continue
                        
                    r = message.get("r")
                    c = message.get("c")
                    
                    success, result = session["game"].play_move(r, c, player_color)
                    if success:
                        # Save move to DB
                        new_move = models.MatchMove(
                            match_id=match_record.id,
                            move_number=len(session["game"].moves),
                            color="B" if player_color == "black" else "W",
                            coordinate=f"{r},{c}"
                        )
                        db.add(new_move)
                        db.commit()
                        
                        # Broadcast move
                        event = {
                            "type": "move",
                            "r": r,
                            "c": c,
                            "color": player_color,
                            "captured": result["captured"],
                            "timers": result["timers"],
                            "board": session["game"].board
                        }
                        
                        # Send to both players and all spectators
                        for pid, ws in session["sockets"].items():
                            await ws.send_text(json.dumps(event))
                        for sid, ws in session["spectators"].items():
                            try:
                                await ws.send_text(json.dumps(event))
                            except Exception:
                                pass
                    else:
                        if result == "Timeout":
                            await process_game_over("timeout")
                        else:
                            await websocket.send_text(json.dumps({"type": "error", "message": str(result)}))
                        
                elif message.get("type") == "pass":
                    if player_color == "spectator":
                        await websocket.send_text(json.dumps({"type": "error", "message": "Spectators cannot pass"}))
                        continue
                        
                    success, result = session["game"].play_pass(player_color)
                    if success:
                        # Save move to DB
                        new_move = models.MatchMove(
                            match_id=match_record.id,
                            move_number=len(session["game"].moves),
                            color="B" if player_color == "black" else "W",
                            coordinate="-1,-1"  # conventional pass rep
                        )
                        db.add(new_move)
                        db.commit()
                        
                        # Broadcast move
                        event = {
                            "type": "move",
                            "r": -1,
                            "c": -1,
                            "color": player_color,
                            "timers": result["timers"],
                            "board": session["game"].board
                        }
                        
                        for pid, ws in session["sockets"].items():
                            await ws.send_text(json.dumps(event))
                        for sid, ws in session["spectators"].items():
                            try:
                                await ws.send_text(json.dumps(event))
                            except Exception:
                                pass
                                
                        # Check if game over by two passes
                        if result.get("game_over"):
                            match_record.status = "finished"
                            match_record.win_reason = "mutual_pass"
                            db.commit()
                            
                            event = {"type": "game_over", "reason": "mutual_pass", "winner_color": "draw"}
                            for pid, ws in session["sockets"].items():
                                await ws.send_text(json.dumps(event))
                    else:
                        if result == "Timeout":
                            await process_game_over("timeout")
                        else:
                            await websocket.send_text(json.dumps({"type": "error", "message": str(result)}))
                        
                elif message.get("type") == "resign":
                    await process_game_over("resign")
            except WebSocketDisconnect:
                break
            except RuntimeError as e:
                if "disconnect" in str(e).lower():
                    break
                logger.error(f"Error processing WS message: {e}", exc_info=True)
            except Exception as e:
                logger.error(f"Error processing WS message: {e}", exc_info=True)
                    
    except WebSocketDisconnect:
        game_manager.remove_player(match_id, str(user.id))
