from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from database import Base, engine

# Create the database tables
Base.metadata.create_all(bind=engine)

app = FastAPI(title="Site Crawler Orchestrator", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from routers import sites, logs

app.include_router(sites.router)
app.include_router(logs.router)

@app.get("/")
def health_check():
    return {"status": "ok", "service": "orchestrator"}
