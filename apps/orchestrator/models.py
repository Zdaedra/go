from sqlalchemy import Boolean, Column, ForeignKey, Integer, String, DateTime, JSON, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database import Base
import uuid

class User(Base):
    __tablename__ = "users"
    __table_args__ = {'extend_existing': True}
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    username = Column(String, unique=True, nullable=False)
    email = Column(String, unique=True, nullable=True) # made true for legacy users
    hashed_password = Column(String, nullable=False)
    
    # Old model fields
    rating_points = Column(Integer, default=200)
    system_points = Column(Integer, default=0)
    puzzle_rating = Column(Integer, default=1000)
    rating_deviation = Column(Integer, default=350)
    rank_level = Column(String(10), default="11k ?")
    problems_solved = Column(Integer, default=0)
    
    # New Model fields
    rating = Column(Integer, default=1500) # Elo rating
    rank = Column(String, default="15k") # e.g., 15k, 1d
    analysis_level = Column(Integer, default=3) # KataGo Global Limit (1=Fast, 5=Oracle)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    matches_as_black = relationship("PlayerMatch", foreign_keys="[PlayerMatch.black_player_id]", back_populates="black_player")
    matches_as_white = relationship("PlayerMatch", foreign_keys="[PlayerMatch.white_player_id]", back_populates="white_player")
    
    game_results = relationship("GameResult", back_populates="user")
    tsumego_attempts = relationship("TsumegoAttempt", back_populates="user")

class PlayerMatch(Base):
    """
    Unified History of games (PvP, Bot, Hero Interactive).
    """
    __tablename__ = "player_matches"
    __table_args__ = {'extend_existing': True}
    id = Column(Integer, primary_key=True, index=True)
    match_type = Column(String, default="pvp") # pvp, bot, hero_interactive
    
    # Nullable player IDs because one side might be a Bot
    black_player_id = Column(String(36), ForeignKey("users.id"), nullable=True)
    white_player_id = Column(String(36), ForeignKey("users.id"), nullable=True)
    bot_id = Column(String, nullable=True) # e.g., 'sprout', 'katago_level_20', 'hero_bot'

    board_size = Column(Integer, default=19)
    ruleset = Column(String, default="japanese")
    time_preset = Column(String, default="rapid") # rapid, blitz, standard, correspondence, none
    status = Column(String, default="active") # active, finished, abandoned
    game_settings = Column(JSON, nullable=True) # handicap, komi, main_time, byoyomi
    result = Column(String, nullable=True) # e.g., B+Resign, W+1.5, Draw
    winner_id = Column(String(36), ForeignKey("users.id"), nullable=True)
    win_reason = Column(String, nullable=True) # resign, timeout, score
    sgf_data = Column(Text, nullable=True) # The actual game record
    is_ranked = Column(Boolean, default=True)
    played_at = Column(DateTime(timezone=True), server_default=func.now())
    
    black_player = relationship("User", foreign_keys=[black_player_id], back_populates="matches_as_black")
    white_player = relationship("User", foreign_keys=[white_player_id], back_populates="matches_as_white")
    winner = relationship("User", foreign_keys=[winner_id])
    moves = relationship("MatchMove", back_populates="match", order_by="MatchMove.move_number", cascade="all, delete-orphan")

class MatchMove(Base):
    """
    Individual tracked moves inside a unified PlayerMatch.
    """
    __tablename__ = "match_moves"
    __table_args__ = {'extend_existing': True}
    id = Column(Integer, primary_key=True, index=True)
    match_id = Column(Integer, ForeignKey("player_matches.id", ondelete="CASCADE"), nullable=False)
    move_number = Column(Integer, nullable=False)
    color = Column(String(1), nullable=False) # 'B' or 'W'
    coordinate = Column(String(5), nullable=False) # e.g., 'dd', 'PASS'
    time_left = Column(Integer, nullable=True) # Time left in ms/sec
    played_at = Column(DateTime(timezone=True), server_default=func.now())
    
    match = relationship("PlayerMatch", back_populates="moves")

# --- End of Active Go Engine Schemas ---
# The legacy Product Reconstruction schemas have been purged from this centralized architecture.

class TsumegoLicense(Base):
    __tablename__ = "tsumego_licenses"
    
    id = Column(String(50), primary_key=True, index=True) # e.g. 'cc-by-nc-sa-4.0'
    name = Column(String(255), nullable=False)
    allows_commercial = Column(Boolean, default=False)
    allows_derivatives = Column(Boolean, default=False)
    allows_redistribution = Column(Boolean, default=False)
    requires_attribution = Column(Boolean, default=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class TsumegoSource(Base):
    __tablename__ = "tsumego_sources"
    
    key = Column(String(50), primary_key=True, index=True) # e.g. 'gogameguru'
    name = Column(String(255), nullable=False)
    base_url = Column(String(500), nullable=True)
    default_license_id = Column(String(50), ForeignKey("tsumego_licenses.id"), nullable=True)
    connector_class = Column(String(100), nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    default_license = relationship("TsumegoLicense")
    collections = relationship("TsumegoCollection", back_populates="source")
    puzzles = relationship("TsumegoPuzzle", back_populates="source")

class TsumegoCollection(Base):
    __tablename__ = "tsumego_collections"
    
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    source_key = Column(String(50), ForeignKey("tsumego_sources.key", ondelete="CASCADE"), nullable=True)
    source_collection_id = Column(String(255), nullable=True)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    puzzle_count = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    source = relationship("TsumegoSource", back_populates="collections")
    puzzles = relationship("TsumegoPuzzle", back_populates="collection")

class TsumegoPuzzle(Base):
    __tablename__ = "tsumego_puzzles"
    
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    collection_id = Column(String(36), ForeignKey("tsumego_collections.id", ondelete="SET NULL"), nullable=True)
    source_key = Column(String(50), ForeignKey("tsumego_sources.key", ondelete="CASCADE"), nullable=True)
    source_puzzle_id = Column(String(255), nullable=False)
    source_url = Column(String(500), nullable=True)
    
    license_id = Column(String(50), ForeignKey("tsumego_licenses.id"), nullable=True)
    
    position_hash = Column(String(64), index=True, nullable=False)
    solution_hash = Column(String(64), index=True, nullable=False)
    
    board_width = Column(Integer, default=19, nullable=False)
    board_height = Column(Integer, default=19, nullable=False)
    to_play = Column(String(1), nullable=False) # 'B' or 'W'
    goal_type = Column(String(50), nullable=True)
    difficulty_source = Column(String(50), nullable=True)
    
    # Extended Problem Model fields
    title = Column(String(255), nullable=True)
    board_position = Column(Text, nullable=True)
    solution = Column(Text, nullable=True)
    difficulty_level = Column(Integer, nullable=True)
    difficulty_rank = Column(String(10), nullable=True)
    problem_rating = Column(Integer, nullable=True)
    
    normalized_json = Column(JSON, nullable=True)
    
    parse_status = Column(String(20), default="pending")
    is_published = Column(Boolean, default=False)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    collection = relationship("TsumegoCollection", back_populates="puzzles")
    source = relationship("TsumegoSource", back_populates="puzzles")
    license = relationship("TsumegoLicense")
    artifacts = relationship("TsumegoArtifact", back_populates="puzzle")
    attempts = relationship("TsumegoAttempt", back_populates="puzzle")

class TsumegoAttempt(Base):
    """
    Log of a single solution attempt for a Tsumego problem.
    """
    __tablename__ = "tsumego_attempts"
    
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    player_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    problem_id = Column(String(36), ForeignKey("tsumego_puzzles.id", ondelete="CASCADE"), nullable=False)
    attempt_number = Column(Integer, default=1, nullable=False)
    is_correct = Column(Boolean, nullable=False)
    used_hint = Column(Boolean, default=False)
    time_spent_seconds = Column(Integer, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    user = relationship("User", back_populates="tsumego_attempts")
    puzzle = relationship("TsumegoPuzzle", back_populates="attempts")

class TsumegoArtifact(Base):
    __tablename__ = "tsumego_artifacts"
    
    id = Column(Integer, primary_key=True, index=True)
    puzzle_id = Column(String(36), ForeignKey("tsumego_puzzles.id", ondelete="CASCADE"), nullable=False)
    artifact_type = Column(String(50), nullable=False) # 'raw_sgf', 'raw_json', etc
    file_path = Column(String(1000), nullable=False)
    file_size = Column(Integer, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    puzzle = relationship("TsumegoPuzzle", back_populates="artifacts")

class TsumegoTag(Base):
    __tablename__ = "tsumego_tags"
    
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String(100), unique=True, nullable=False)
    description = Column(String(500), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class GameResult(Base):
    __tablename__ = "game_results"
    
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    match_type = Column(String(50), nullable=False) # 'pvp', 'bot', 'tsumego'
    points_change = Column(Integer, nullable=False)
    new_rating = Column(Integer, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    user = relationship("User", back_populates="game_results")
