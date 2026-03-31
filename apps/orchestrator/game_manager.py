import time

class GoGame:
    def __init__(self, board_size=19, time_preset="rapid"):
        self.board_size = board_size
        self.board = [[None for _ in range(board_size)] for _ in range(board_size)]
        self.current_player = 'black'
        self.captures = {'black': 0, 'white': 0}
        self.moves = [] # history
        self.winner = None
        
        # Init Timers
        limits = {"blitz": 300, "rapid": 900, "standard": 1800}
        start_time = limits.get(time_preset, 900)
        self.timers = {"black": start_time, "white": start_time}
        self.last_move_time = None
        self.moves = [] # history []
        self.pass_count = 0
        self.winner = None
        
    def get_neighbors(self, r, c):
        neighbors = []
        if r > 0: neighbors.append((r-1, c))
        if r < self.board_size - 1: neighbors.append((r+1, c))
        if c > 0: neighbors.append((r, c-1))
        if c < self.board_size - 1: neighbors.append((r, c+1))
        return neighbors
        
    def get_chain_and_liberties(self, board, start_r, start_c):
        color = board[start_r][start_c]
        chain = []
        liberties = set()
        visited = set()
        stack = [(start_r, start_c)]
        
        while stack:
            r, c = stack.pop()
            if (r, c) in visited: continue
            visited.add((r, c))
            chain.append((r, c))
            
            for nr, nc in self.get_neighbors(r, c):
                if board[nr][nc] is None:
                    liberties.add((nr, nc))
                elif board[nr][nc] == color and (nr, nc) not in visited:
                    stack.append((nr, nc))
                    
        return chain, len(liberties)
        
    def play_move(self, r, c, player_color):
        if self.board[r][c] is not None:
            return False, "Space occupied"
        if player_color != self.current_player:
            return False, "Not your turn"
            
        new_board = [row[:] for row in self.board]
        new_board[r][c] = player_color
        opponent_color = 'white' if player_color == 'black' else 'black'
        
        captured_stones_count = 0
        
        # Check captures
        for nr, nc in self.get_neighbors(r, c):
            if new_board[nr][nc] == opponent_color:
                chain, libs = self.get_chain_and_liberties(new_board, nr, nc)
                if libs == 0:
                    for cr, cc in chain:
                        new_board[cr][cc] = None
                        captured_stones_count += 1
                        
        # Check suicide (Ko rule is omitted for simplicity in MVP)
        if captured_stones_count == 0:
            chain, libs = self.get_chain_and_liberties(new_board, r, c)
            if libs == 0:
                return False, "Suicide move not allowed"
                
        # Check Timers
        if self.last_move_time is not None:
            elapsed = time.time() - self.last_move_time
            self.timers[player_color] -= elapsed
            if self.timers[player_color] <= 0:
                self.timers[player_color] = 0
                return False, "Timeout"

        # Apply move
        self.board = new_board
        self.captures[player_color] += captured_stones_count
        self.current_player = opponent_color
        self.moves.append({'r': r, 'c': c, 'color': player_color})
        
        # Start opponent clock
        self.last_move_time = time.time()
        
        return True, {"captured": captured_stones_count, "timers": self.timers}

    def play_pass(self, player_color):
        if player_color != self.current_player:
            return False, "Not your turn"
            
        now = time.time()
        if self.last_move_time is not None:
            elapsed = int(now - self.last_move_time)
            self.timers[self.current_player] -= elapsed
            if self.timers[self.current_player] <= 0:
                self.timers[self.current_player] = 0
                return False, "Timeout"
                
        self.last_move_time = now
        self.moves.append({"r": -1, "c": -1, "color": player_color, "type": "pass"})
        self.pass_count += 1
        
        self.current_player = 'white' if self.current_player == 'black' else 'black'
        
        game_over = self.pass_count >= 2
        
        return True, {"game_over": game_over, "timers": self.timers}

class GameManager:
    def __init__(self):
        # match_id -> {"game": GoGame, "sockets": {user_id: websocket}, "colors": {user_id: 'black'}}
        self.active_games = {}
        
    def create_game(self, match_id, board_size=19, time_preset="rapid"):
        self.active_games[match_id] = {
            "game": GoGame(board_size, time_preset),
            "sockets": {},
            "colors": {},
            "spectators": {}
        }
        
    def add_player(self, match_id, user_id, websocket, color):
        if match_id in self.active_games:
            self.active_games[match_id]["sockets"][user_id] = websocket
            self.active_games[match_id]["colors"][user_id] = color

    def remove_player(self, match_id, user_id):
        if match_id in self.active_games:
            if user_id in self.active_games[match_id]["sockets"]:
                del self.active_games[match_id]["sockets"][user_id]
                
    def add_spectator(self, match_id, user_id, websocket):
        if match_id in self.active_games:
            self.active_games[match_id]["spectators"][user_id] = websocket

    def remove_spectator(self, match_id, user_id):
        if match_id in self.active_games:
            if user_id in self.active_games[match_id]["spectators"]:
                del self.active_games[match_id]["spectators"][user_id]

    def get_game(self, match_id):
        return self.active_games.get(match_id)

game_manager = GameManager()
