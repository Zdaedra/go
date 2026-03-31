import os
import requests
import logging

logger = logging.getLogger(__name__)

TELEGRAM_BOT_TOKEN = os.environ.get("TELEGRAM_BOT_TOKEN")
TELEGRAM_CHAT_ID = os.environ.get("TELEGRAM_CHAT_ID")

def send_telegram_message(text: str):
    if not TELEGRAM_BOT_TOKEN or not TELEGRAM_CHAT_ID:
        logger.warning("Telegram credentials not set. Skipping notification.")
        return
        
    url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage"
    payload = {
        "chat_id": TELEGRAM_CHAT_ID,
        "text": text,
        "parse_mode": "Markdown"
    }
    try:
        requests.post(url, json=payload, timeout=5)
    except Exception as e:
        logger.error(f"Failed to send Telegram message: {e}")

def notify_task_started(task_id: str, title: str):
    msg = f"🚀 *Task Started*\nTask: `{task_id}`\nTitle: {title}"
    send_telegram_message(msg)

def notify_task_completed(task_id: str, title: str, iterations: int, escalations: int, files_changed: int, summary: str):
    msg = f"✅ *Task Completed*\nTask: `{task_id}`\nTitle: {title}\nStatus: success\nIterations: {iterations}\nGPT Escalations: {escalations}\nFiles changed: {files_changed}\nResult: {summary}"
    send_telegram_message(msg)

def notify_task_failed(task_id: str, title: str, iterations: int, escalations: int, reason: str):
    msg = f"❌ *Task Failed*\nTask: `{task_id}`\nTitle: {title}\nStatus: failed\nIterations: {iterations}\nGPT Escalations: {escalations}\nReason: {reason}"
    send_telegram_message(msg)

def notify_escalation(task_id: str, iteration: int):
    msg = f"⚠️ *Escalating to GPT*\nTask: `{task_id}`\nIteration {iteration} failed. Requesting 2nd opinion..."
    send_telegram_message(msg)
