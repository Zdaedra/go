import math

def calculate_expected_score(player_rating: int, problem_rating: int) -> float:
    """
    Calculates the expected score using the Elo formula.
    Returns a value between 0 (certain loss) and 1 (certain win).
    """
    return 1.0 / (1.0 + 10.0 ** ((problem_rating - player_rating) / 400.0))

def get_k_factor(attempt_number: int, previously_solved: bool = False, used_hint: bool = False) -> int:
    """
    Determines the K-factor (rating volatility) based on attempt history.
    """
    if previously_solved:
        return 0
    
    if used_hint:
        return 5
        
    if attempt_number == 1:
        return 40
    elif attempt_number in (2, 3):
        return 20
    else:
        return 10

def get_numeric_level(rating: int) -> int:
    """
    Step 11: Converts rating to a numeric level for comparison.
    500 rating = level 5 (25k)
    2000 rating = level 20 (10k)
    2900 rating = level 29 (1k)
    3000 rating = level 30 (1d)
    """
    if rating < 100:
        return 1
    return rating // 100

def calculate_rank(rating: int, problems_solved: int) -> str:
    """
    Step 10: Converts a numeric Rating into a Go Rank (Kyu/Dan).
    Scale: 500 = 25k, 2900 = 1k, 3000 = 1d.
    """
    if rating < 500:
        rating = 500
        
    rank_str = ""
    if rating <= 2999:
        # Для кю: rank = 30 - floor(rating / 100)
        kyu_val = 30 - math.floor(rating / 100)
        rank_str = f"{kyu_val}k"
    else:
        # Для данов: rank = floor(rating / 100) - 29
        dan_val = math.floor(rating / 100) - 29
        if dan_val < 1: dan_val = 1
        rank_str = f"{dan_val}d"

    # Preliminary marker
    if problems_solved < 5:
        return f"{rank_str} ?"
    return rank_str

def calculate_rating_change(player_rating: int, problem_rating: int, attempt_number: int, is_correct: bool, previously_solved: bool = False, time_spent_seconds: int = 0) -> tuple[int, int]:
    """
    Returns (delta_player, delta_problem).
    delta_player is added to the user's puzzle_rating.
    delta_problem is added to the puzzle's problem_rating.
    Uses a static table for delta_player based on attempts and level difference.
    Includes a speed bonus if time_spent_seconds < 30 and is_correct.
    Uses simple Elo-like adjustment for delta_problem.
    """
    if previously_solved:
        return 0, 0
        
    relation = compare_levels(player_rating, problem_rating)
    delta_player = 0
    
    if is_correct:
        if attempt_number == 1:
            if relation == "HIGHER": delta_player = 25
            elif relation == "EQUAL": delta_player = 15
            elif relation == "LOWER": delta_player = 5
        elif attempt_number in (2, 3):
            if relation == "HIGHER": delta_player = 10
            elif relation == "EQUAL": delta_player = 5
            elif relation == "LOWER": delta_player = 2
        else: # attempt 4+
            if relation == "HIGHER": delta_player = 3
            elif relation == "EQUAL": delta_player = 1
            elif relation == "LOWER": delta_player = 0
            
        # Speed Bonus (Step 8)
        if time_spent_seconds < 30:
            if relation == "HIGHER": delta_player += 5
            elif relation == "EQUAL": delta_player += 3
            elif relation == "LOWER": delta_player += 1
    else:
        if relation == "HIGHER": delta_player = -5
        elif relation == "EQUAL": delta_player = -3
        elif relation == "LOWER": delta_player = -1

    # Keep auto-adjustment for problem rating based on win/loss expectations
    expected = calculate_expected_score(player_rating, problem_rating)
    actual_score = 1.0 if is_correct else 0.0
    p_factor = 10
    delta_problem = round(p_factor * (expected - actual_score))
    
    return delta_player, delta_problem

def calculate_match_rating_change(player_rating: int, opponent_rating: int, is_win: bool) -> int:
    """
    Calculates the rating change for a PvP match using standard Elo.
    Returns the points to add (or subtract if negative) to the player's rating.
    """
    expected = calculate_expected_score(player_rating, opponent_rating)
    actual_score = 1.0 if is_win else 0.0
    k_factor = 32
    return round(k_factor * (actual_score - expected))

def compare_levels(player_rating: int, problem_rating: int) -> str:
    """
    Compares the player and problem rating using their numeric levels.
    """
    player_level = get_numeric_level(player_rating)
    problem_level = get_numeric_level(problem_rating)
    
    if problem_level > player_level:
        return "HIGHER"
    elif abs(problem_level - player_level) <= 1:
        return "EQUAL"
    else: # problem_level < player_level - 1
        return "LOWER"
