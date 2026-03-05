import os
from sqlalchemy import create_engine, Column, String, Integer, DateTime, Text, ForeignKey, JSON
from sqlalchemy.orm import declarative_base, sessionmaker
from datetime import datetime

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/golesson")

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

class Game(Base):
    __tablename__ = "games"
    id = Column(String, primary_key=True, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    board_size = Column(Integer, default=9)
    sgf_url = Column(String) # MinIO path

class Job(Base):
    __tablename__ = "jobs"
    id = Column(String, primary_key=True, index=True)
    game_id = Column(String, ForeignKey("games.id"))
    status = Column(String, default="queued") # queued, running, done, error
    progress = Column(Integer, default=0)
    message = Column(String, default="")
    created_at = Column(DateTime, default=datetime.utcnow)

class Lesson(Base):
    __tablename__ = "lessons"
    id = Column(String, primary_key=True, index=True)
    game_id = Column(String, ForeignKey("games.id"))
    storyboard_url = Column(String) # MinIO path to the JSON
    created_at = Column(DateTime, default=datetime.utcnow)

def init_db():
    Base.metadata.create_all(bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
