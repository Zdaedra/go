from fastapi import FastAPI, Request

app = FastAPI()

@app.post("/log-interaction/")
async def log_interaction(request: Request):
    data = await request.json()
    # Replace this with database or file logging
    print(f"Logging interaction: {data}")
    return {"status": "success", "data": data}

@app.post("/log-accessibility-event/")
async def log_accessibility_event(request: Request):
    data = await request.json()
    # Replace this with database or file logging
    print(f"Logging accessibility event: {data}")
    return {"status": "success", "event": data}