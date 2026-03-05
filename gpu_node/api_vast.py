import os
import json
import logging
import datetime
import tempfile
import requests
from fastapi import FastAPI, BackgroundTasks, HTTPException, Header
from pydantic import BaseModel

from katago_runner import analyze_sgf_with_katago
from lesson_director import build_lesson_moments
from llm_narrator import narrate_lesson_moments
from tts_steps import generate_tts_for_lesson
from app.models.storyboard import Storyboard, StoryMeta, Moment

app = FastAPI(title="Go Lesson MVP - Vast Compute Node")

logger = logging.getLogger("uvicorn.error")

class ComputeTicket(BaseModel):
    job_id: str
    game_id: str
    input_sgf_url: str
    storyboard_put_url: str
    callback_base_url: str
    callback_token: str

def perform_compute_task(ticket: ComputeTicket):
    logger.info(f"Starting compute task for job {ticket.job_id}")
    
    auth_header = {"Authorization": f"Bearer {ticket.callback_token}"}
    
    def report_progress(progress: int, message: str):
        try:
            requests.post(
                f"{ticket.callback_base_url}/v1/jobs/{ticket.job_id}/progress",
                json={"progress": progress, "message": message},
                headers=auth_header,
                timeout=10
            )
            logger.info(f"Progress {progress}%: {message}")
        except Exception as e:
            logger.error(f"Failed to report progress: {e}")

    def report_fail(message: str):
        try:
            requests.post(
                f"{ticket.callback_base_url}/v1/jobs/{ticket.job_id}/fail",
                json={"message": message},
                headers=auth_header,
                timeout=10
            )
            logger.error(f"Failed job {ticket.job_id}: {message}")
        except Exception as e:
            logger.error(f"Failed to report fail status: {e}")

    try:
        # Download SGF
        report_progress(15, "Downloading SGF from storage...")
        r = requests.get(ticket.input_sgf_url, timeout=30)
        r.raise_for_status()
        sgf_bytes = r.content

        # KataGo Analysis
        report_progress(25, "Running KataGo engine analysis...")
        analysis_data, parsed_moves = analyze_sgf_with_katago(sgf_bytes)

        # Build Lesson
        report_progress(45, "Structuring pedagogical lesson...")
        user_color = "B"
        lesson_plan = build_lesson_moments(ticket.game_id, parsed_moves, analysis_data, user_color)
        
        # Audio URL path based on current implementation
        S3_PUBLIC_ENDPOINT = os.getenv("S3_PUBLIC_ENDPOINT", "http://localhost:9002")
        S3_BUCKET = os.getenv("S3_BUCKET", "games")
        base_audio_url = f"{S3_PUBLIC_ENDPOINT}/{S3_BUCKET}/lessons/{ticket.game_id}/audio/"
        lesson_plan["meta"]["assets"]["baseAudioUrl"] = base_audio_url

        # LLM Storyboard
        report_progress(60, "Generating commentary script with LLM...")
        llm_output = narrate_lesson_moments(lesson_plan)

        # TTS Translation
        report_progress(75, "Generating audio voiceovers...")
        with tempfile.TemporaryDirectory() as tmpdirname:
            audio_files = generate_tts_for_lesson(llm_output, tmpdirname)
            
            # Fetch presigned PUT URLs for each audio and upload
            for file_path, file_name in audio_files:
                # Ask Hetzner for a presigned PUT URL for this specific audio file
                obj_key = f"lessons/{ticket.game_id}/{file_name}"
                presigned_req = requests.post(
                    f"{ticket.callback_base_url}/v1/jobs/{ticket.job_id}/presigned_put",
                    json={"file_name": obj_key},
                    headers=auth_header,
                    timeout=10
                )
                presigned_req.raise_for_status()
                audio_put_url = presigned_req.json().get("url")
                
                # Upload the audio file to Minio
                with open(file_path, "rb") as f:
                    put_resp = requests.put(audio_put_url, data=f, headers={"Content-Type": "audio/mpeg"})
                    put_resp.raise_for_status()

        # Finalize Storyboard JSON
        report_progress(90, "Uploading final storyboard...")
        sgf_url = f"{S3_PUBLIC_ENDPOINT}/{S3_BUCKET}/sgf/{ticket.game_id}.sgf"
        
        meta_dict = llm_output.get("meta", {})
        meta_dict["sgfUrl"] = sgf_url
        meta_dict["engine"] = {
            "visitsPass1": int(os.environ.get("ANALYSIS_VISITS_PASS1", 300)),
            "visitsPass2": int(os.environ.get("ANALYSIS_VISITS_PASS2", 1600))
        }

        storyboard_obj = Storyboard(
            meta=StoryMeta(**meta_dict),
            moments=[Moment(**m) for m in llm_output.get("moments", [])]
        )
        
        storyboard_json = storyboard_obj.model_dump_json()
        
        # Use provided PUT URL for storyboard
        put_resp = requests.put(ticket.storyboard_put_url, data=storyboard_json.encode('utf-8'), headers={"Content-Type": "application/json"})
        put_resp.raise_for_status()

        # Job Complete!
        # The S3 URL we construct here doesn't matter too much as long as it points to Hetzner's public endpoint
        storyboard_public_url = f"{S3_PUBLIC_ENDPOINT}/{S3_BUCKET}/lessons/{ticket.game_id}/storyboard.json"
        
        res = requests.post(
            f"{ticket.callback_base_url}/v1/jobs/{ticket.job_id}/complete",
            json={"storyboard_url": storyboard_public_url},
            headers=auth_header,
            timeout=10
        )
        res.raise_for_status()
        logger.info(f"Job {ticket.job_id} successfully completed!")

    except Exception as e:
        report_fail(str(e))


@app.post("/v1/run")
async def run_compute_job(ticket: ComputeTicket, background_tasks: BackgroundTasks):
    background_tasks.add_task(perform_compute_task, ticket)
    return {"status": "accepted", "message": "Job queued on compute node"}

@app.get("/health")
def healthz():
    return {"status": "ok"}
