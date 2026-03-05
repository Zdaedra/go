from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), '..', '..', '..', 'scripts'))
import loop_db

app = FastAPI(title="Go Mechanics Bot Metrics API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
def startup_event():
    # Ensure DB is created if it doesn't exist
    loop_db.init_db()

@app.get("/api/status")
def get_status():
    """
    Returns the current execution loop status and overall metrics
    so the dashboard can render it nicely.
    """
    try:
        data = loop_db.get_dashboard_data()
        return data
    except Exception as e:
        return {"error": str(e), "status": "Database Error"}

@app.post("/api/bot/start")
def start_bot():
    try:
        loop_db.set_target_state('running')
        return {"status": "success", "message": "Bot target state set to running"}
    except Exception as e:
        return {"error": str(e)}

@app.post("/api/bot/stop")
def stop_bot():
    try:
        loop_db.set_target_state('paused')
        return {"status": "success", "message": "Bot target state set to paused"}
    except Exception as e:
        return {"error": str(e)}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8081)
