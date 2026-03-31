import os
import json
import re
import time
from celery import Celery
from sqlalchemy.orm import Session
from sqlalchemy.sql import func
from database import SessionLocal
import models
from openai import OpenAI
from pathlib import Path
from telegram_bot import notify_task_started, notify_task_completed, notify_task_failed, notify_escalation

REDIS_URL = os.environ.get("REDIS_URL", "redis://localhost:6379/0")
OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY")

code_celery_app = Celery(
    "code_worker_tasks",
    broker=REDIS_URL,
    backend=REDIS_URL
)

code_celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_default_queue="code_generation_queue",
    # ensure single thread execution for file IO safety
    worker_concurrency=1
)

client = OpenAI(api_key=OPENAI_API_KEY) if OPENAI_API_KEY else None
GENERATED_PROJECTS_DIR = "/data/generated_projects"

def parse_code_blocks(response_text: str):
    """
    Looks for blocks like:
    FILE: src/App.tsx
    ```tsx
    ...
    ```
    """
    pattern = r"FILE:\s*([^\n]+)\n```[a-z]*\n(.*?)```"
    matches = re.findall(pattern, response_text, re.DOTALL)
    modules = []
    for filepath, code_content in matches:
        modules.append({"path": filepath.strip(), "content": code_content.strip()})
    return modules

def execute_generation_step(db: Session, task, project_dir, prompt: str, iteration: int):
    site = task.spec.site
    if not client:
        print("OPENAI_API_KEY not set. Mocking code generation...")
        time.sleep(3)
        modules = [
            {"path": "src/components/FeatureModule.tsx", "content": "export default function FeatureModule() { return <div>Generated Code Mock</div>; }"},
        ]
    else:
        print(f"Calling OpenAI API for Code Generation (Iteration {iteration})...")
        response = client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": "You are a senior software engineer."},
                {"role": "user", "content": prompt}
            ]
        )
        response_text = response.choices[0].message.content
        modules = parse_code_blocks(response_text)
        
    print(f"Generated {len(modules)} modules.")
    
    for index, mod in enumerate(modules):
        file_path = mod["path"]
        abs_path = project_dir / file_path
        
        abs_path.parent.mkdir(parents=True, exist_ok=True)
        with open(abs_path, "w") as f:
            f.write(mod["content"])
            
        db_module = models.GeneratedModule(
            task_id=task.id,
            file_path=file_path,
            code_content=mod["content"],
            status="active"
        )
        db.add(db_module)
        task.progress = int((index + 1) / max(len(modules), 1) * 100)
        db.commit()
    
    return modules

@code_celery_app.task(name="tasks.generate_code", bind=True, max_retries=1)
def generate_code(self, task_id: int, fallback_error: str = None):
    """
    Main Code Generation Task.
    Reads the Spec, asks GPT to write code, saves it to disk. 
    If Good Bot is required, sends to good_bot_worker for verification.
    """
    print(f"Starting Code Generation for CodeTask {task_id}")
    db: Session = SessionLocal()
    try:
        task = db.query(models.CodeTask).filter(models.CodeTask.id == task_id).first()
        if not task or task.status == "completed":
            return
            
        spec = task.spec
        site = spec.site
        project_dir = Path(GENERATED_PROJECTS_DIR) / site.name.replace(" ", "_").lower()
        project_dir.mkdir(parents=True, exist_ok=True)
        
        # Create TaskExecution tracking model
        execution = models.TaskExecution(
            task_id=f"code_task_{task.id}",
            task_type="ui_task",
            status="running"
        )
        db.add(execution)
        db.commit()
        
        notify_task_started(str(task.id), spec.title)
        
        base_prompt = "System: You are an expert Software Engineer generating React Next.js and FastAPI code based on technical specifications.\n"
        base_prompt += "Task: Generate the FULL implementation files for the following Technical Specification. You MUST wrap the code for each file as:\nFILE: <path>\n```<lang>\n<code>\n```\n\n"
        base_prompt += "--- TECHNICAL SPECIFICATION ---\n" + spec.content
        
        prompt = base_prompt
        if fallback_error:
            print(f"Applying Fallback Error Context: {fallback_error}")
            prompt += f"\n\n--- PREVIOUS BROWSER VERIFICATION FAILED ---\nPlease fix the code to resolve these issues:\n{fallback_error}"
            
        modules = execute_generation_step(db, task, project_dir, prompt, 1)
        execution.files_changed = [{"path": m["path"]} for m in modules]
        db.commit()
        
        # Wait a moment for Next.js/FastAPI hot-reload logic if it exists on the volume
        time.sleep(5)
        
        # Determine if Good Bot is needed
        execution.status = "completed"
        execution.finished_at = func.now()
        
        if task.requires_good_bot:
            print("Dispatching Good Bot Verification...")
            # Leave task status as 'verifying' 
            task.status = "verifying"
            code_celery_app.send_task(
                "tasks.verify_code_module",
                kwargs={"task_id": task.id},
                queue="good_bot_queue"
            )
        else:
            task.status = "completed"
            task.progress = 100
            task.completed_at = func.now()
            
        if spec.batch:
            for f in spec.batch.features:
                if f.status == "code_started":
                    f.status = "code_completed"
                    
        db.commit()
        
        if not task.requires_good_bot:
            notify_task_completed(str(task.id), spec.title, 1, 0, len(modules), "Code Generated Successfully (Manual Verification Required)")
            
        print(f"Code Generation complete for task {task_id}.")
        
    except Exception as exc:
        db.rollback()
        print(f"Error in generate_code: {exc}")
        task = db.query(models.CodeTask).filter(models.CodeTask.id == task_id).first()
        if task:
            task.status = "failed"
            db.commit()
        self.retry(exc=exc, countdown=10)
    finally:
        db.close()

