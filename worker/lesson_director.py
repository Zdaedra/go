from position_features import FeatureExtractor9x9, PositionFeatures
from visual_templates import (
    TeachingPack, GroupInfo, CandidateMove,
    build_steps_for_mistake, build_steps_for_strong
)
from typing import List, Dict, Any, Optional

def classify_teaching_goal(features: PositionFeatures, user_color: str, best_move: str, impact: float, pv_best: List[str]) -> str:
    urgent_user = features.threats.urgent_groups_user
    
    best_is_defensive = best_move in features.defense_points_user
    dying_soon = any(g.in_atari for g in urgent_user)
    best_is_atari_or_capture = best_move in features.attack_points_user
    best_is_connect = any(c.point == best_move and c.kind == "connect" for c in features.connect_cut_points)
    best_is_cut = any(c.point == best_move and c.kind == "cut" for c in features.connect_cut_points)
    
    if urgent_user and (dying_soon or abs(impact) >= 8.0):
        return "LIFE_DEATH_MINI"
        
    if urgent_user and best_is_defensive:
        return "URGENCY_DEFENSE"
        
    if best_is_atari_or_capture or features.threats.has_atari_for_user or features.threats.has_atari_against_user:
        return "TACTIC_ATARI"
        
    if best_is_connect or best_is_cut:
        return "CUT_CONNECT"
        
    if not urgent_user and abs(impact) < 5.0:
        return "INITIATIVE_SENTE"
        
    return "TERRITORY_TRADE"

def create_moment_from_pack(game_id: str, analysis_item: dict, moves: List[List[str]], user_color: str, moment_type: str) -> dict:
    move_number = analysis_item["turn"]
    impact = analysis_item["delta"]
    color = analysis_item["color"]
    played_move = analysis_item["actual_move"]
    
    moves_before = moves[:move_number-1]
    
    extractor = FeatureExtractor9x9()
    features = extractor.extract(moves_before, user_color)
    
    best_moves = analysis_item.get("best_moves", [])
    best_pvs = analysis_item.get("best_pv", [])
    
    best_move = best_moves[0] if best_moves else None
    if not best_move:
        best_move = played_move # fallback
        
    best_pv = best_pvs[0] if best_pvs else [played_move]
    
    teaching_goal = classify_teaching_goal(features, user_color, best_move, impact, best_pv)
    
    # Map features to GroupInfo for visual templates
    problem_groups = []
    if features.threats.urgent_groups_user:
        for g in features.threats.urgent_groups_user:
            problem_groups.append(GroupInfo(
                label="Слабая группа",
                stones=g.stones,
                liberties=g.liberties,
                critical_points=features.defense_points_user
            ))
            
    cut_point = None
    atari_point = None
    if teaching_goal == "CUT_CONNECT":
        cuts = [c.point for c in features.connect_cut_points if c.kind in ["connect", "cut"]]
        if cuts: cut_point = cuts[0]
    elif teaching_goal == "TACTIC_ATARI":
        if best_move in features.attack_points_user:
            atari_point = best_move
            
    key_zone_bbox = None
    if teaching_goal in ["INITIATIVE_SENTE", "TERRITORY_TRADE"]:
        # A rough bounding box covering played_move and best_move to represent "the zone"
        if played_move and best_move:
            key_zone_bbox = {"from": played_move, "to": best_move}

    # Title dictionary mapping
    goal_titles = {
        "LIFE_DEATH_MINI": "Вопрос жизни и смерти",
        "URGENCY_DEFENSE": "Срочность защиты",
        "TACTIC_ATARI": "Тактический удар",
        "CUT_CONNECT": "Соединение и разрез",
        "INITIATIVE_SENTE": "Борьба за инициативу",
        "TERRITORY_TRADE": "Территориальный обмен"
    }
    
    candidates = []
    if best_move:
        candidates.append(CandidateMove(move=best_move, label="Лучший план", pv=best_pv))
    if played_move and played_move != best_move:
        candidates.append(CandidateMove(move=played_move, label="Ваш ход", pv=[]))

    bad_line = [played_move, "TEMP_OPPONENT_REPLY"]
    good_line = best_pv[:6]

    pack = TeachingPack(
        move_before=max(0, move_number - 1),
        move_number=move_number,
        player=color,
        user_color=user_color,
        title=goal_titles.get(teaching_goal, "Важный момент"),
        preview="Lesson preview placeholder",
        impact=impact,
        teaching_goal=teaching_goal,
        main_question="Какой план был наиболее приоритетным?",
        takeaway="Ключевой момент",
        problem_groups=problem_groups,
        key_zone_bbox=key_zone_bbox,
        cut_point=cut_point,
        atari_point=atari_point,
        best_move=best_move,
        played_move=played_move,
        candidates=candidates,
        bad_line=bad_line,
        good_line=good_line,
        consequence_move=move_number + 6,
        consequence_label="Результат на доске"
    )
    
    if moment_type == "mistake":
        steps = build_steps_for_mistake(pack)
    else:
        steps = build_steps_for_strong(pack)

    return {
        "moment_id": f"{moment_type}_move_{move_number}",
        "type": moment_type,
        "move_number": move_number,
        "player": color,
        "impact": impact,
        "teachingGoal": teaching_goal,
        "title": pack.title,
        "preview": pack.preview,
        "jumpMove": pack.move_before,
        "teachingPackSummary": {
            "mainQuestion": pack.main_question,
            "takeaway": pack.takeaway,
            "problemGroups": [g.to_dict() for g in problem_groups],
            "candidates": [{"move": c.move, "label": c.label} for c in candidates]
        },
        "steps": steps
    }

def build_lesson_moments(game_id: str, moves: List[List[str]], analysis_data: List[dict], user_color: str) -> dict:    
    mistakes = sorted([d for d in analysis_data if d.get("delta", 0) < -1.5], key=lambda x: x["delta"])[:4]
    strong_moves = sorted([d for d in analysis_data if d.get("delta", 0) > 1.5], key=lambda x: x["delta"], reverse=True)[:2]
    
    moments = []
    for m in mistakes:
        pack = create_moment_from_pack(game_id, m, moves, user_color, "mistake")
        moments.append(pack)
        
    for m in strong_moves:
        pack = create_moment_from_pack(game_id, m, moves, user_color, "strong")
        moments.append(pack)
        
    moments.sort(key=lambda x: x["move_number"])
    
    return {
        "meta": {
            "gameId": game_id,
            "boardSize": 9,
            "userColor": user_color,
            "assets": {
                "baseAudioUrl": f"https://kiosk.example.com/assets/lessons/{game_id}/audio/"
            }
        },
        "moments": moments
    }
