from dataclasses import dataclass
from typing import List, Literal, Optional, Dict

Color = Literal["B", "W"]
Coord = str
TeachingGoal = Literal[
    "URGENCY_DEFENSE",
    "TACTIC_ATARI",
    "CUT_CONNECT",
    "LIFE_DEATH_MINI",
    "INITIATIVE_SENTE",
    "TERRITORY_TRADE",
]

@dataclass
class CandidateMove:
    move: Coord
    label: str  # "защита" | "тактика" | "темп" | ...
    pv: List[Coord]         # 6-10 полуходов (coords)
    pv_mode: Literal["ghost", "step"] = "ghost"

@dataclass
class GroupInfo:
    label: str
    stones: List[Coord]
    liberties: int
    critical_points: Optional[List[Coord]] = None  # для life/death или срочности
    
    def to_dict(self):
        return {
            "label": self.label,
            "stones": self.stones,
            "liberties": self.liberties,
            "critical_points": self.critical_points
        }

@dataclass
class TeachingPack:
    move_before: int
    move_number: int
    player: Color
    user_color: Color

    title: str
    preview: str
    impact: float
    teaching_goal: TeachingGoal

    main_question: str
    takeaway: str

    # ключевые объекты для визуализации
    problem_groups: List[GroupInfo]          # обычно 1, иногда 2
    key_zone_bbox: Optional[Dict[str, Coord]] = None  # {"from": "A1", "to": "D4"} для вторжений/территории
    cut_point: Optional[Coord] = None
    atari_point: Optional[Coord] = None
    best_move: Optional[Coord] = None
    played_move: Optional[Coord] = None

    # линии демонстраций
    candidates: List[CandidateMove] = None
    bad_line: Optional[List[Coord]] = None
    good_line: Optional[List[Coord]] = None

    # куда прыгнуть, чтобы увидеть последствия в реальной партии
    consequence_move: Optional[int] = None
    consequence_label: Optional[str] = None


# ---------- JSON Actions builders ----------

def jump(move: int): return {"type": "jump", "move": move}
def clear(): return {"type": "clearOverlays"}
def highlight(stones: List[Coord]): return {"type": "highlight", "stones": stones}
def mark(at: Coord, shape: str): return {"type": "mark", "at": at, "shape": shape}
def label(text: str, at: Coord): return {"type": "label", "text": text, "at": at}
def arrow(frm: Coord, to: Coord, text: Optional[str] = None):
    a = {"type": "arrow", "from": frm, "to": to}
    if text: a["label"] = text
    return a
def region(points: List[Coord], text: Optional[str] = None):
    r = {"type": "region", "points": points}
    if text: r["label"] = text
    return r
def spotlight_bbox(frm: Coord, to: Coord, text: Optional[str] = None, dim: float = 0.6):
    s = {"type": "spotlight", "shape": "bbox", "bbox": {"from": frm, "to": to}, "dimOpacity": dim}
    if text: s["label"] = text
    return s
def spotlight_points(points: List[Coord], text: Optional[str] = None, dim: float = 0.6):
    s = {"type": "spotlight", "shape": "points", "points": points, "dimOpacity": dim}
    if text: s["label"] = text
    return s
def show_best(at: Coord): return {"type": "showBestMove", "at": at}
def show_seq(moves: List[Coord], mode: str = "step", speed: float = 0.9, as_color: Optional[Color] = None):
    s = {"type": "showSequence", "moves": moves, "mode": mode}
    if mode == "step": s["speedSecPerMove"] = speed
    if as_color: s["asColor"] = as_color
    return s


# ---------- Step builder ----------

def step(step_id: str, mode: str, say: str, actions: List[dict]):
    # Note: audio URL is generated downstream or assigned later based on step_id.
    # We omit it here or let downstream fill it.
    st = {
        "id": step_id,
        "mode": mode,
        "say": say,
        "actions": actions
    }
    if mode == "demo_bad": st["overlayPresetKey"] = "bad"
    if mode == "demo_good": st["overlayPresetKey"] = "good"
    if mode == "stopframe": st["overlayPresetKey"] = "neutral"
    return st


# ---------- Canonical visual templates per teaching goal ----------

def build_stopframe_actions(pack: TeachingPack) -> List[dict]:
    acts = [jump(pack.move_before), clear()]

    # Spotlight logic by goal
    if pack.teaching_goal in ("URGENCY_DEFENSE", "LIFE_DEATH_MINI"):
        if pack.problem_groups:
            g = pack.problem_groups[0]
            acts.append(spotlight_points(g.stones, "Фокус: слабая группа" if pack.teaching_goal=="URGENCY_DEFENSE" else "Фокус: жизнь/смерть", 0.62))
            acts.append(highlight(g.stones))
            acts.append(label(pack.main_question, g.stones[0]))
    elif pack.teaching_goal in ("TACTIC_ATARI", "CUT_CONNECT"):
        focus_point = pack.atari_point or pack.cut_point
        if focus_point:
            acts.append(spotlight_points([focus_point], "Фокус: ключевая точка", 0.62))
            acts.append(mark(focus_point, "triangle"))
            acts.append(label(pack.main_question, focus_point))
        elif pack.problem_groups:
            g = pack.problem_groups[0]
            acts.append(spotlight_points(g.stones, "Фокус", 0.62))
            acts.append(highlight(g.stones))
            acts.append(label(pack.main_question, g.stones[0]))
    else:
        if pack.key_zone_bbox:
            acts.append(spotlight_bbox(pack.key_zone_bbox["from"], pack.key_zone_bbox["to"], "Фокус: зона плана", 0.6))
            acts.append(label(pack.main_question, pack.key_zone_bbox["from"]))
        else:
            if pack.problem_groups:
                g = pack.problem_groups[0]
                acts.append(spotlight_points(g.stones, "Фокус", 0.6))
                acts.append(highlight(g.stones))
                acts.append(label(pack.main_question, g.stones[0]))

    if pack.teaching_goal == "URGENCY_DEFENSE" and pack.problem_groups:
        g = pack.problem_groups[0]
        if g.critical_points:
            acts.append(arrow(g.critical_points[0], g.stones[0], "давление"))
        acts.append(label("СРОЧНО", g.stones[0]))
    elif pack.teaching_goal == "TACTIC_ATARI" and pack.atari_point:
        acts.append(label("АТАРИ / forcing", pack.atari_point))
    elif pack.teaching_goal == "CUT_CONNECT" and pack.cut_point:
        acts.append(label("РАЗРЕЗ", pack.cut_point))
    elif pack.teaching_goal == "INITIATIVE_SENTE":
        if pack.key_zone_bbox:
            frm = pack.key_zone_bbox["from"]; to = pack.key_zone_bbox["to"]
            acts.append(region([frm, to], "план соперника")) 
            acts.append(label("Задача: забрать темп", frm))

    return acts


def build_candidates_actions(pack: TeachingPack) -> List[dict]:
    acts = [jump(pack.move_before), clear()]
    if pack.problem_groups:
        acts.append(spotlight_points(pack.problem_groups[0].stones, "Кандидаты", 0.55))
        acts.append(highlight(pack.problem_groups[0].stones))

    if not pack.candidates:
        return acts

    for i, c in enumerate(pack.candidates[:3]):
        shape = "circle" if i == 0 else "square"
        acts.append(mark(c.move, shape))
        acts.append(label(c.label, c.move))
    return acts


def build_yourmove_actions(pack: TeachingPack, is_strong: bool) -> List[dict]:
    acts = [jump(pack.move_number), clear()]

    if pack.played_move:
        acts.append(mark(pack.played_move, "circle" if is_strong else "x"))
        acts.append(label("Сильный ход" if is_strong else "Ваш ход", pack.played_move))

    if is_strong and pack.teaching_goal == "INITIATIVE_SENTE" and pack.played_move:
        if pack.good_line and len(pack.good_line) >= 2:
            acts.append(arrow(pack.played_move, pack.good_line[0], "угроза"))
            acts.append(arrow(pack.played_move, pack.good_line[1], "угроза"))
        acts.append(label("ТЕМП", pack.played_move))

    if not is_strong and pack.problem_groups:
        acts.append(highlight(pack.problem_groups[0].stones))
        acts.append(label("Проблема осталась", pack.problem_groups[0].stones[0]))

    return acts


def build_bad_demo_actions(pack: TeachingPack) -> List[dict]:
    acts = [jump(pack.move_before), clear()]
    if pack.problem_groups:
        g = pack.problem_groups[0]
        acts.append(spotlight_points(g.stones, "Плохой сценарий", 0.62))
        acts.append(highlight(g.stones))
        acts.append(label("Плохой сценарий", g.stones[0]))

    if pack.bad_line:
        acts.append(show_seq(pack.bad_line, mode="step", speed=0.9))

    if pack.teaching_goal == "URGENCY_DEFENSE" and pack.problem_groups and pack.problem_groups[0].critical_points:
        acts.append(arrow(pack.problem_groups[0].critical_points[0], pack.problem_groups[0].stones[0], "давление"))
        acts.append(label("вынуждено", pack.problem_groups[0].stones[0]))

    if pack.teaching_goal == "CUT_CONNECT" and pack.cut_point:
        acts.append(mark(pack.cut_point, "triangle"))
        acts.append(label("разрез", pack.cut_point))

    if pack.teaching_goal == "TACTIC_ATARI" and pack.atari_point:
        acts.append(mark(pack.atari_point, "triangle"))
        acts.append(label("forcing", pack.atari_point))

    return acts


def build_good_demo_actions(pack: TeachingPack) -> List[dict]:
    acts = [jump(pack.move_before), clear()]

    if pack.problem_groups:
        g = pack.problem_groups[0]
        acts.append(spotlight_points(g.stones, "Хороший план", 0.62))
        acts.append(highlight(g.stones))

    if pack.best_move:
        acts.append(show_best(pack.best_move))
        acts.append(label("Лучший план", pack.best_move))

    if pack.good_line:
        acts.append(show_seq(pack.good_line, mode="step", speed=0.9))

    if pack.teaching_goal == "URGENCY_DEFENSE" and pack.best_move and pack.problem_groups:
        acts.append(arrow(pack.best_move, pack.problem_groups[0].stones[0], "усиление"))
        acts.append(label("стабильно", pack.problem_groups[0].stones[0]))

    if pack.teaching_goal == "CUT_CONNECT" and pack.best_move:
        acts.append(label("соединить", pack.best_move))

    if pack.teaching_goal == "INITIATIVE_SENTE" and pack.best_move:
        acts.append(label("темп", pack.best_move))

    return acts


def build_consequence_actions(pack: TeachingPack) -> List[dict]:
    move = pack.consequence_move or (pack.move_number + 6)
    acts = [jump(move), clear()]

    if pack.key_zone_bbox:
        acts.append(spotlight_bbox(pack.key_zone_bbox["from"], pack.key_zone_bbox["to"], "Результат", 0.6))
        acts.append(label(pack.consequence_label or "Видно последствие", pack.key_zone_bbox["from"]))
    elif pack.problem_groups:
        g = pack.problem_groups[0]
        acts.append(spotlight_points(g.stones, "Результат", 0.6))
        acts.append(highlight(g.stones))
        acts.append(label(pack.consequence_label or "Видно последствие", g.stones[0]))
    else:
        # Fallback to E5
        acts.append(label(pack.consequence_label or "Последствие", "E5"))

    return acts


def build_takeaway_actions(pack: TeachingPack) -> List[dict]:
    acts = [jump(pack.move_before), clear()]

    if pack.problem_groups:
        g = pack.problem_groups[0]
        acts.append(spotlight_points(g.stones, "Takeaway", 0.55))
        acts.append(highlight(g.stones))
        acts.append(label(pack.takeaway, g.stones[0]))
    else:
        # Fallback to best_move or E5
        acts.append(label(pack.takeaway, pack.best_move if pack.best_move else "E5"))

    return acts


# ---------- Full moment step assembly ----------

def build_steps_for_mistake(pack: TeachingPack) -> List[dict]:
    steps = []

    steps.append(step(
        f"m{pack.move_number}_01_stopframe", "stopframe",
        say="",
        actions=build_stopframe_actions(pack)
    ))

    if pack.candidates:
        steps.append(step(
            f"m{pack.move_number}_02_candidates", "candidates",
            say="",
            actions=build_candidates_actions(pack)
        ))

    steps.append(step(
        f"m{pack.move_number}_03_yourmove", "yourmove",
        say="",
        actions=build_yourmove_actions(pack, is_strong=False)
    ))

    steps.append(step(
        f"m{pack.move_number}_04_bad_demo", "demo_bad",
        say="",
        actions=build_bad_demo_actions(pack)
    ))

    steps.append(step(
        f"m{pack.move_number}_05_good_demo", "demo_good",
        say="",
        actions=build_good_demo_actions(pack)
    ))

    steps.append(step(
        f"m{pack.move_number}_06_consequence", "consequence",
        say="",
        actions=build_consequence_actions(pack)
    ))

    steps.append(step(
        f"m{pack.move_number}_07_takeaway", "takeaway",
        say="",
        actions=build_takeaway_actions(pack)
    ))

    return steps


def build_steps_for_strong(pack: TeachingPack) -> List[dict]:
    steps = []

    steps.append(step(
        f"s{pack.move_number}_01_stopframe", "stopframe",
        say="",
        actions=build_stopframe_actions(pack)
    ))

    steps.append(step(
        f"s{pack.move_number}_02_strongmove", "yourmove",
        say="",
        actions=build_yourmove_actions(pack, is_strong=True)
    ))

    steps.append(step(
        f"s{pack.move_number}_03_demo_bad", "demo_bad",
        say="",
        actions=build_bad_demo_actions(pack)
    ))

    steps.append(step(
        f"s{pack.move_number}_04_demo_good", "demo_good",
        say="",
        actions=build_good_demo_actions(pack)
    ))

    steps.append(step(
        f"s{pack.move_number}_05_consequence", "consequence",
        say="",
        actions=build_consequence_actions(pack)
    ))

    steps.append(step(
        f"s{pack.move_number}_06_takeaway", "takeaway",
        say="",
        actions=build_takeaway_actions(pack)
    ))

    return steps
