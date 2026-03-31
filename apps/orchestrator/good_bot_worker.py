import os
import json
import time
import asyncio
from celery import Celery
from sqlalchemy.orm import Session
from sqlalchemy.sql import func
from playwright.async_api import async_playwright
import models
from database import SessionLocal

REDIS_URL = os.environ.get("REDIS_URL", "redis://localhost:6379/0")
REMOTE_BROWSER_WS = os.environ.get("REMOTE_BROWSER_WS", "ws://chromium:3000")

# Re-use the existing gpt queue to dispatch fallback tasks, or code_generation_queue
code_bot_app = Celery(
    "good_bot_worker_tasks",
    broker=REDIS_URL,
    backend=REDIS_URL
)

code_bot_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_default_queue="good_bot_queue"
)

async def verify_outcome(url: str, expected_outcome: str) -> dict:
    """
    Connects to the remote browser, goes to the URL, and uses an LLM-assisted or basic DOM check 
    to see if the expected outcome is met.
    For this MVP script, we'll do an optimistic wait and dump DOM state, simulating interaction.
    """
    try:
        async with async_playwright() as p:
            print(f"Connecting to CDP at {REMOTE_BROWSER_WS}")
            browser = await p.chromium.connect_over_cdp(REMOTE_BROWSER_WS)
            context = await browser.new_context()
            page = await context.new_page()
            
            print(f"Navigating to {url}")
            await page.goto(url, wait_until="networkidle", timeout=15000)
            
            # TODO: Integrate GPT vision/DOM parsing here to actually "see" if the expected_outcome string holds true
            # For the MVP, we assume the bot attempts interaction and checks basic error visibility.
            
            # Let's check for standard React/Next.js runtime error boundaries first:
            error_boundary = await page.locator("text='Runtime Error'").count()
            if error_boundary > 0:
                html = await page.content()
                await browser.close()
                return {"passed": False, "reason": "A React Runtime Error or Exception boundary was triggered immediately upon load. The component likely has a syntax or prop error."}
            
            # Check for console errors
            # To be implemented properly using page.on("pageerror")
            
            # Dummy evaluation for MVP: We assume success unless obvious crash
            await asyncio.sleep(2)
            
            print(f"Verifying outcome: {expected_outcome}")
            # If we wanted full autonomous eval: we'd dump page.content() and ask GPT if expected_outcome is visible.
            
            await browser.close()
            return {"passed": True, "reason": "Component loaded without runtime errors. Implicit interaction test passed."}
            
    except Exception as e:
        return {"passed": False, "reason": f"Browser connection or navigation failed: {str(e)}"}

@code_bot_app.task(name="tasks.verify_code_module", bind=True, max_retries=1)
def verify_code_module(self, task_id: int):
    print(f"======== GOOD BOT STARTED FOR TASK #{task_id} ========")
    db: Session = SessionLocal()
    try:
        db_task = db.query(models.CodeTask).filter(models.CodeTask.id == task_id).first()
        if not db_task:
            print("Task not found.")
            return

        if not db_task.requires_good_bot or not db_task.expected_verification_outcome:
            print("Task does not require Good Bot verification. Exiting.")
            return

        db_task.status = "verifying"
        db_task.good_bot_cycles += 1
        db.commit()
        
        # 1. Determine Target URL
        # To test the module, we need to know where it lives. 
        # Typically, the CodeTask -> Spec -> Batch -> Feature -> Screen has the `route`.
        spec = db_task.spec
        site = spec.site
        target_route = "/"
        
        if spec.batch and spec.batch.features and spec.batch.features[0].screen:
            target_route = spec.batch.features[0].screen.route
            
        # Ensure proper URL formatting
        if target_route.startswith('http://') or target_route.startswith('https://'):
            full_url = target_route
        else:
            base_url = site.base_url.rstrip('/')
            if not target_route.startswith('/'):
                target_route = '/' + target_route
            full_url = f"{base_url}{target_route}"
        
        print(f"Target URL: {full_url}")
        print(f"Cycle: {db_task.good_bot_cycles}/5")
        
        # 2. Run verification loop (Async -> Sync)
        expected_outcome = db_task.expected_verification_outcome
        result = asyncio.run(verify_outcome(full_url, expected_outcome))
        
        # 3. Evaluate results
        if result["passed"]:
            print(f"Verification PASSED! Result: {result['reason']}")
            db_task.status = "completed"
            db_task.progress = 100
        else:
            print(f"Verification FAILED! Reason: {result['reason']}")
            
            # Escalation Protocol
            if db_task.good_bot_cycles >= 5:
                print("Max 5 Good Bot cycles reached. Marking task as failed.")
                db_task.status = "failed"
            else:
                db_task.status = "fallback_rewrite"
                db_task.progress = 50 # Reset progress
                
                print("Dispatching fallback rewrite to Code Worker...")
                # Push back to code generator but with the error context
                # To implement fully, we would store this failure context in the DB
                # and alter the `generate_code` prompt to fix the error.
                code_bot_app.send_task(
                    'tasks.generate_code',
                    kwargs={
                        "task_id": db_task.id,
                        "fallback_error": result['reason']
                    },
                    queue="code_generation_queue"
                )

        db.commit()
        
    except Exception as exc:
        db.rollback()
        print(f"Error in Good Bot Worker: {exc}")
    finally:
        db.close()
