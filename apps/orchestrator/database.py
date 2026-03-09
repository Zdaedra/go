import os
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

# Expects DATABASE_URL from environment; default for local sqlite dev if missing (though we will use Postgres)
SQLALCHEMY_DATABASE_URL = os.environ.get(
    "DATABASE_URL", 
    "sqlite:///./orchestrator.db"
)

# Connect args specific to SQLite to avoid threading issues. Ignored by Postgres.
connect_args = {"check_same_thread": False} if SQLALCHEMY_DATABASE_URL.startswith("sqlite") else {}

engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args=connect_args
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
