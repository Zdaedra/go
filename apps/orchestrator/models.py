from sqlalchemy import Boolean, Column, ForeignKey, Integer, String, DateTime, JSON, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database import Base

class Site(Base):
    __tablename__ = "sites"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True, nullable=False)
    base_url = Column(String, nullable=False)
    login_credentials = Column(JSON, nullable=True) # E.g., username/password or token logic
    status = Column(String, default="Stopped") # Running, Paused, Stopped, Error
    crawl_depth = Column(Integer, default=3)
    game_mode = Column(Boolean, default=False)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    crawl_runs = relationship("CrawlRun", back_populates="site")
    screens = relationship("Screen", back_populates="site")
    games = relationship("Game", back_populates="site")

class CrawlRun(Base):
    __tablename__ = "crawl_runs"
    
    id = Column(Integer, primary_key=True, index=True)
    site_id = Column(Integer, ForeignKey("sites.id"), nullable=False)
    status = Column(String, default="Running") # Running, Completed, Failed
    started_at = Column(DateTime(timezone=True), server_default=func.now())
    completed_at = Column(DateTime(timezone=True), nullable=True)
    
    site = relationship("Site", back_populates="crawl_runs")

class Screen(Base):
    __tablename__ = "screens"
    
    id = Column(Integer, primary_key=True, index=True)
    site_id = Column(Integer, ForeignKey("sites.id"), nullable=False)
    title = Column(String, nullable=True)
    route = Column(String, index=True, nullable=False) # E.g. /home, /lobby
    screenshot_path = Column(String, nullable=True)
    dom_dump_path = Column(String, nullable=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    site = relationship("Site", back_populates="screens")
    features = relationship("Feature", back_populates="screen")

class Feature(Base):
    """
    Structured feature logic found on a particular screen.
    """
    __tablename__ = "features"
    
    id = Column(Integer, primary_key=True, index=True)
    screen_id = Column(Integer, ForeignKey("screens.id"), nullable=False)
    name = Column(String, nullable=False)
    type = Column(String, nullable=False) # e.g., CTA, Navigation, Game Start
    action_description = Column(Text, nullable=True) # E.g. "Starts match flow"
    preconditions = Column(Text, nullable=True)
    result = Column(Text, nullable=True)
    observed_behavior = Column(Text, nullable=True)
    status = Column(String, default="unconfirmed") # unconfirmed, confirmed
    
    screen = relationship("Screen", back_populates="features")

class Game(Base):
    """
    If the bot played a game of Go on this site, we log the result.
    """
    __tablename__ = "games"
    
    id = Column(Integer, primary_key=True, index=True)
    site_id = Column(Integer, ForeignKey("sites.id"), nullable=False)
    board_size = Column(Integer, default=9)
    result = Column(String, nullable=True) # W+Resign, B+2.5, etc.
    played_at = Column(DateTime(timezone=True), server_default=func.now())
    
    site = relationship("Site", back_populates="games")
    moves = relationship("GameMove", back_populates="game")

class GameMove(Base):
    __tablename__ = "game_moves"
    
    id = Column(Integer, primary_key=True, index=True)
    game_id = Column(Integer, ForeignKey("games.id"), nullable=False)
    move_number = Column(Integer, nullable=False)
    color = Column(String, nullable=False) # B or W
    coordinate = Column(String, nullable=False) # e.g. D4, PASS
    ui_event_log = Column(Text, nullable=True) # Corresponding UI state changes observed during this move
    
    game = relationship("Game", back_populates="moves")

class Log(Base):
    __tablename__ = "logs"
    
    id = Column(Integer, primary_key=True, index=True)
    level = Column(String, default="info")
    message = Column(Text, nullable=False)
    timestamp = Column(DateTime(timezone=True), server_default=func.now())
