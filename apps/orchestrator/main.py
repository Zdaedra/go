import asyncio
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from database import Base, engine, SessionLocal

import models

# Create the database tables
models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="Site Crawler Orchestrator", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3005", "http://89.167.122.76:3005"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from routers import auth, users, matches, tsumego, games, sockets, ai_tutor, engine
from database import engine as db_engine

app.include_router(auth.router)
app.include_router(users.router)
app.include_router(matches.router)
app.include_router(tsumego.router)
app.include_router(games.router)
app.include_router(sockets.router)
app.include_router(ai_tutor.router)
app.include_router(engine.router)

@app.get("/")
def health_check():
    return {"status": "ok", "service": "orchestrator"}

@app.on_event("startup")
async def startup_event():
    # Placeholder for future background tasks (e.g. matchmaking queue workers)
    pass
