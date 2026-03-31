import os
import json
import time
from celery import Celery
from sqlalchemy.orm import Session
from sqlalchemy.sql import func
from database import SessionLocal
import models
from openai import OpenAI
import base64

REDIS_URL = os.environ.get("REDIS_URL", "redis://localhost:6379/0")
OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY")

gpt_celery_app = Celery(
    "gpt_worker_tasks",
    broker=REDIS_URL,
    backend=REDIS_URL
)

gpt_celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_default_queue="gpt_spec_queue"
)

client = OpenAI(api_key=OPENAI_API_KEY) if OPENAI_API_KEY else None

@gpt_celery_app.task(name="tasks.generate_spec", bind=True, max_retries=3)
def generate_spec(self, batch_id: int, auto_generate_code: bool = False):
    print(f"Starting GPT Spec Generation for batch {batch_id} (AutoGen: {auto_generate_code})")
    db: Session = SessionLocal()
    try:
        batch = db.query(models.GptBatch).filter(models.GptBatch.id == batch_id).first()
        if not batch:
            print(f"Batch {batch_id} not found")
            return
            
        if batch.status == "completed":
            print(f"Batch {batch_id} already completed")
            return
        
        batch.status = "processing"
        db.commit()
        
        # Gather context
        features = batch.features
        site = batch.site
        
        prompt = f"System: You are an expert Product Manager and Systems Architect.\n"
        prompt += f"Task: Write a detailed Technical Specification for the following features found on {site.base_url}.\n\n"
        
        for f in features:
            prompt += f"Feature: {f.name} ({f.type})\n"
            prompt += f"Preconditions: {f.preconditions}\n"
            prompt += f"Result: {f.result}\n"
            prompt += f"Observed Behavior: {f.observed_behavior}\n"
            prompt += "---\n"
            
        prompt += "\nThe spec must be in Markdown format, with clear sections for Context, Requirements, Edge Cases, and Data Models."
        prompt += "\n\nCRITICAL: At the very end of your response, you MUST include a JSON block enclosed in ```json ... ``` with exactly two keys:\n"
        prompt += "1. \"requires_good_bot\" (boolean): set to true if these features involve a testable UI interaction (e.g., clicking a button, opening a modal).\n"
        prompt += "2. \"expected_verification_outcome\" (string or null): a strict, single-sentence definition of what the DOM or URL should look like after interaction to prove it works. E.g., 'A modal with text Success appears' or 'The URL changes to /dashboard'.\n"
        
        if not client:
            print("OPENAI_API_KEY not set. Mocking response...")
            time.sleep(3)
            markdown_response = f"# Specification for Batch {batch_id}\n\n*Mock generated spec based on features. Configure OPENAI_API_KEY to generate real specs.*\n\n"
            for f in features:
                markdown_response += f"## {f.name}\n- **Type**: {f.type}\n- **Result**: {f.result}\n\n"
            token_usage = 150
        else:
            print("Calling OpenAI API with Vision context...")
            
            # Extract image from the first feature's screen (they should all be from the same screen in a batch)
            image_base64 = None
            if features and features[0].screen and features[0].screen.screenshot_path:
                try:
                    with open(features[0].screen.screenshot_path, "rb") as image_file:
                        image_base64 = base64.b64encode(image_file.read()).decode('utf-8')
                except Exception as e:
                    print(f"Warning: Could not load screenshot for vision context: {e}")
                    
            content_payload = [{"type": "text", "text": prompt}]
            if image_base64:
                content_payload.append({
                    "type": "image_url",
                    "image_url": {
                        "url": f"data:image/png;base64,{image_base64}"
                    }
                })

            response = client.chat.completions.create(
                model="gpt-4o",
                messages=[
                    {"role": "system", "content": "You are a technical product manager analyzing logical components of a UI screen."},
                    {"role": "user", "content": content_payload}
                ]
            )
            markdown_response = response.choices[0].message.content
            token_usage = response.usage.total_tokens

        # Extract GoodBot config
        import re
        requires_good_bot = False
        expected_outcome = None
        
        json_match = re.search(r'```json\s*(.*?)\s*```', markdown_response, re.DOTALL)
        if json_match:
            try:
                bot_config = json.loads(json_match.group(1))
                requires_good_bot = bot_config.get("requires_good_bot", False)
                expected_outcome = bot_config.get("expected_verification_outcome")
                print(f"Parsed GoodBot Config: req={requires_good_bot}, outcome={expected_outcome}")
            except Exception as e:
                print(f"Failed to parse Good Bot config: {e}")

        # Create Spec Document
        spec = models.SpecDocument(
            site_id=site.id,
            batch_id=batch.id,
            title=f"Technical Spec for Batch {batch.id}",
            content=markdown_response,
            status="generated"
        )
        db.add(spec)
        
        # Update Features
        for f in features:
            f.status = "spec_received"
            
        # Update Batch
        batch.status = "completed"
        batch.token_usage_estimate = token_usage
        batch.completed_at = func.now()
        
        db.commit()
        print(f"Spec generation complete for batch {batch_id}")
        
        # If Auto-Pilot is enabled, chain to Code Generation
        if auto_generate_code:
            print("Auto-Pilot active: Dispatching code generation task.")
            db_task = models.CodeTask(
                spec_id=spec.id,
                status="pending",
                requires_good_bot=requires_good_bot,
                expected_verification_outcome=expected_outcome
            )
            db.add(db_task)
            for f in batch.features:
                if f.status in ["spec_received", "approved_for_codegen"]:
                    f.status = "code_started"
            db.commit()
            db.refresh(db_task)
            
            # Dispatch to code worker using current app BUT specifying the remote queue
            gpt_celery_app.send_task(
                'tasks.generate_code', 
                kwargs={"task_id": db_task.id},
                queue="code_generation_queue" 
            )
            
    except Exception as exc:
        db.rollback()
        print(f"Error in generate_spec: {exc}")
        batch = db.query(models.GptBatch).filter(models.GptBatch.id == batch_id).first()
        if batch:
            batch.status = "failed"
            db.commit()
        self.retry(exc=exc, countdown=10)
    finally:
        db.close()
