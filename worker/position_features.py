from dataclasses import dataclass, field
from typing import Dict, List, Literal, Optional, Tuple, Set

Color = Literal["B", "W"]
Coord = str

COLS = "ABCDEFGHJ"
ROWS = "123456789"

@dataclass
class Group:
    color: Color
    stones: List[Coord] = field(default_factory=list)
    liberties: int = 0
    liberty_points: List[Coord] = field(default_factory=list)
    in_atari: bool = False
    in_danger: bool = False
    label: Optional[str] = None
    
    def to_dict(self):
        return {
            "color": self.color,
            "stones": sorted(self.stones),
            "liberties": self.liberties,
            "liberty_points": sorted(self.liberty_points),
            "in_atari": self.in_atari,
            "in_danger": self.in_danger,
            "label": self.label
        }

@dataclass
class ConnectCutPoint:
    point: Coord
    kind: Literal["connect", "cut"]
    affects_colors: Tuple[Color, Color]
    strength: float
    note: Optional[str] = None

@dataclass
class Threats:
    has_atari_for_user: bool
    has_atari_against_user: bool
    urgent_groups_user: List[Group]
    urgent_groups_opp: List[Group]

@dataclass
class PositionFeatures:
    groups: Dict[Color, List[Group]]
    threats: Threats
    connect_cut_points: List[ConnectCutPoint]
    defense_points_user: List[Coord]
    attack_points_user: List[Coord]


class FeatureExtractor9x9:
    def __init__(self, board_size: int = 9):
        self.board_size = board_size
        
    def _normalize_coord(self, coord: str) -> Optional[str]:
        if not coord or coord.lower() == "pass": return None
        c = coord.upper()
        if len(c) != 2 or c[0] not in COLS or c[1] not in ROWS: return None
        return c

    def _get_neighbors(self, coord: str) -> List[str]:
        col_char, row_char = coord[0], coord[1:]
        col_idx = COLS.index(col_char)
        row_idx = ROWS.index(row_char)
        
        neighbors = []
        if col_idx > 0: neighbors.append(f"{COLS[col_idx-1]}{row_char}")
        if col_idx < self.board_size - 1: neighbors.append(f"{COLS[col_idx+1]}{row_char}")
        if row_idx > 0: neighbors.append(f"{col_char}{ROWS[row_idx-1]}")
        if row_idx < self.board_size - 1: neighbors.append(f"{col_char}{ROWS[row_idx+1]}")
        return neighbors

    def play_moves(self, moves: List[List[str]]) -> Dict[str, str]:
        """ Replay moves to get board state. Return map from coord -> color. """
        board: Dict[str, str] = {}
        for m in moves:
            if len(m) != 2: continue
            color, raw_coord = m[0], m[1]
            coord = self._normalize_coord(raw_coord)
            if not coord: continue
            
            board[coord] = color
            
            # Resolve captures
            groups = self.groups_from_board(board)
            enemy_color = "W" if color == "B" else "B"
            to_capture = set()
            for g in groups[enemy_color]:
                if g.liberties == 0:
                    to_capture.update(g.stones)
            
            if to_capture:
                for c in to_capture:
                    if c in board: del board[c]
            else:
                # check suicide
                for g in groups[color]:
                    if g.liberties == 0 and coord in g.stones:
                        # suicide play, remove it
                        if coord in board: del board[coord]
        return board
        
    def groups_from_board(self, board: Dict[str, str]) -> Dict[Color, List[Group]]:
        visited = set()
        result: Dict[Color, List[Group]] = {"B": [], "W": []}
        
        for coord, color in board.items():
            if coord in visited: continue
            
            group_stones = set()
            liberty_points = set()
            queue = [coord]
            
            while queue:
                curr = queue.pop(0)
                if curr in visited: continue
                visited.add(curr)
                group_stones.add(curr)
                
                for n in self._get_neighbors(curr):
                    n_color = board.get(n)
                    if n_color == color:
                        if n not in visited:
                            queue.append(n)
                    elif n_color is None:
                        liberty_points.add(n)
            
            result[color].append(Group(
                color=color,
                stones=list(group_stones),
                liberties=len(liberty_points),
                liberty_points=list(liberty_points),
                in_atari=(len(liberty_points) == 1),
                in_danger=(len(liberty_points) <= 2)
            ))
            
        return result

    def find_connect_cut_points(self, board: Dict[str, str], groups: Dict[Color, List[Group]]) -> List[ConnectCutPoint]:
        empty_pts = []
        for c in COLS[:self.board_size]:
            for r in ROWS[:self.board_size]:
                pt = f"{c}{r}"
                if pt not in board:
                    empty_pts.append(pt)
                    
        points = []
        for pt in empty_pts:
            neighbors = self._get_neighbors(pt)
            b_neighbor_groups = set()
            w_neighbor_groups = set()
            
            for n in neighbors:
                n_color = board.get(n)
                if n_color == "B":
                    for idx, g in enumerate(groups["B"]):
                        if n in g.stones: b_neighbor_groups.add(idx)
                elif n_color == "W":
                    for idx, g in enumerate(groups["W"]):
                        if n in g.stones: w_neighbor_groups.add(idx)
                        
            # Check Connect (same color neighbors from distinct groups)
            if len(b_neighbor_groups) >= 2:
                points.append(ConnectCutPoint(pt, "connect", ("B", "B"), 0.8))
            if len(w_neighbor_groups) >= 2:
                points.append(ConnectCutPoint(pt, "connect", ("W", "W"), 0.8))
                
            # Check Cut (opposing color neighbors from distinct groups)
            # Simplistic: if point touches two groups of enemy
            if len(b_neighbor_groups) >= 2:
                points.append(ConnectCutPoint(pt, "cut", ("W", "B"), 0.6))
            if len(w_neighbor_groups) >= 2:
                points.append(ConnectCutPoint(pt, "cut", ("B", "W"), 0.6))
                
            # Diagonal wedge cut heuristic (touches two diagonal stones of same color, with no connection)
            # For simplicity, just relying on straight neighbors for now, 
            # maybe expand to diagonals later.
            
        return points

    def candidate_defense_points(self, urgent_user: List[Group], connect_cut: List[ConnectCutPoint], user_color: Color) -> List[Coord]:
        cands = set()
        for g in urgent_user:
            for l in g.liberty_points:
                cands.add(l)
            # Find connects affecting this color
            for cc in connect_cut:
                if cc.kind == "connect" and cc.affects_colors[0] == user_color:
                    # check if point is adjacent to our urgent group
                    for st in g.stones:
                        if cc.point in self._get_neighbors(st):
                            cands.add(cc.point)
        return list(cands)

    def candidate_attack_points(self, urgent_opp: List[Group], connect_cut: List[ConnectCutPoint], opp_color: Color) -> List[Coord]:
        cands = set()
        for g in urgent_opp:
            for l in g.liberty_points:
                cands.add(l)
            for cc in connect_cut:
                if cc.kind == "cut" and cc.affects_colors[1] == opp_color:
                    for st in g.stones:
                        if cc.point in self._get_neighbors(st):
                            cands.add(cc.point)
        return list(cands)

    def extract(self, moves: List[List[str]], user_color: Color) -> PositionFeatures:
        opp_color = "W" if user_color == "B" else "B"
        
        board = self.play_moves(moves)
        groups = self.groups_from_board(board)
        
        cc_points = self.find_connect_cut_points(board, groups)
        
        urgent_user = [g for g in groups[user_color] if g.in_danger]
        urgent_opp = [g for g in groups[opp_color] if g.in_danger]
        
        has_atari_user = any(g.in_atari for g in groups[opp_color])
        has_atari_against_user = any(g.in_atari for g in groups[user_color])
        
        threats = Threats(
            has_atari_for_user=has_atari_user,
            has_atari_against_user=has_atari_against_user,
            urgent_groups_user=urgent_user,
            urgent_groups_opp=urgent_opp
        )
        
        defense_pts = self.candidate_defense_points(urgent_user, cc_points, user_color)
        attack_pts = self.candidate_attack_points(urgent_opp, cc_points, opp_color)
        
        return PositionFeatures(
            groups=groups,
            threats=threats,
            connect_cut_points=cc_points,
            defense_points_user=defense_pts,
            attack_points_user=attack_pts
        )
