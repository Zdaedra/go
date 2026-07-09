"""Minimal backend for the Go openings mobile app (docs/app-spec.md §6).

Email-code auth, free-tier daily usage metering, RevenueCat webhook and
progress sync. SQLite + JWT; the openings database itself ships inside
the app bundle, so this service stays tiny.

Run:
    uvicorn app.main:app --port 8080
Env:
    APP_SECRET        JWT signing secret (required outside dev)
    DB_PATH           sqlite file (default ./mobile.db)
    DEV_MODE=1        return the emailed code in the API response
    SMTP_HOST/PORT/USER/PASSWORD/FROM   outgoing mail (optional; without
                      it codes are printed to the log — dev only)
    RC_WEBHOOK_SECRET shared secret for the RevenueCat webhook
    FREE_DAILY_LIMIT  default 3
"""

import hashlib
import hmac
import json
import os
import secrets
import smtplib
import sqlite3
import time
from contextlib import contextmanager
from datetime import date, datetime, timedelta, timezone
from email.message import EmailMessage

import jwt
from fastapi import Depends, FastAPI, Header, HTTPException
from pydantic import BaseModel, EmailStr

SECRET = os.environ.get("APP_SECRET", "dev-secret-change-me")
DB_PATH = os.environ.get("DB_PATH", "mobile.db")
DEV_MODE = os.environ.get("DEV_MODE") == "1"
FREE_DAILY_LIMIT = int(os.environ.get("FREE_DAILY_LIMIT", "3"))
TRIAL_DAYS = int(os.environ.get("TRIAL_DAYS", "7"))
CODE_TTL_MINUTES = 10
TOKEN_TTL_DAYS = 30

app = FastAPI(title="go-openings-mobile-backend")


# --- storage ----------------------------------------------------------------

@contextmanager
def db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()


def init_db() -> None:
    with db() as conn:
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS users (
              id INTEGER PRIMARY KEY,
              email TEXT UNIQUE NOT NULL,
              plan TEXT NOT NULL DEFAULT 'free',
              created_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS codes (
              email TEXT PRIMARY KEY,
              code_hash TEXT NOT NULL,
              expires_at REAL NOT NULL,
              attempts INTEGER NOT NULL DEFAULT 0
            );
            CREATE TABLE IF NOT EXISTS usage (
              user_id INTEGER NOT NULL,
              day TEXT NOT NULL,
              opening_id TEXT NOT NULL,
              UNIQUE(user_id, day, opening_id)
            );
            CREATE TABLE IF NOT EXISTS progress (
              user_id INTEGER PRIMARY KEY,
              data TEXT NOT NULL DEFAULT '{}'
            );
            """
        )


init_db()


# --- helpers ----------------------------------------------------------------

def hash_code(email: str, code: str) -> str:
    return hashlib.sha256(f"{email}:{code}:{SECRET}".encode()).hexdigest()


def send_code_email(email: str, code: str) -> None:
    host = os.environ.get("SMTP_HOST")
    if not host:
        print(f"[dev] login code for {email}: {code}")
        return
    msg = EmailMessage()
    msg["Subject"] = "Код входа — Дебюты Го 9×9"
    msg["From"] = os.environ.get("SMTP_FROM", "noreply@example.com")
    msg["To"] = email
    msg.set_content(
        f"Твой код входа: {code}\n\n"
        f"Код действует {CODE_TTL_MINUTES} минут. Если это не ты — просто удали письмо."
    )
    with smtplib.SMTP(host, int(os.environ.get("SMTP_PORT", "587"))) as smtp:
        smtp.starttls()
        user = os.environ.get("SMTP_USER")
        if user:
            smtp.login(user, os.environ["SMTP_PASSWORD"])
        smtp.send_message(msg)


def make_token(user_id: int, email: str) -> str:
    payload = {
        "sub": str(user_id),
        "email": email,
        "exp": datetime.now(timezone.utc) + timedelta(days=TOKEN_TTL_DAYS),
    }
    return jwt.encode(payload, SECRET, algorithm="HS256")


def current_user(authorization: str = Header(default="")) -> sqlite3.Row:
    if not authorization.startswith("Bearer "):
        raise HTTPException(401, "Missing bearer token")
    try:
        payload = jwt.decode(authorization[7:], SECRET, algorithms=["HS256"])
    except jwt.PyJWTError:
        raise HTTPException(401, "Invalid or expired token")
    with db() as conn:
        row = conn.execute(
            "SELECT * FROM users WHERE id = ?", (int(payload["sub"]),)
        ).fetchone()
    if row is None:
        raise HTTPException(401, "Unknown user")
    return row


def daily_used(conn: sqlite3.Connection, user_id: int) -> int:
    return conn.execute(
        "SELECT COUNT(*) FROM usage WHERE user_id = ? AND day = ?",
        (user_id, date.today().isoformat()),
    ).fetchone()[0]


def trial_days_left(user: sqlite3.Row) -> int:
    created = datetime.fromisoformat(user["created_at"])
    elapsed = datetime.now(timezone.utc) - created
    return max(0, TRIAL_DAYS - elapsed.days)


# --- schemas ----------------------------------------------------------------

class EmailIn(BaseModel):
    email: EmailStr


class VerifyIn(BaseModel):
    email: EmailStr
    code: str


class UsageIn(BaseModel):
    opening_id: str


class ProgressIn(BaseModel):
    data: dict


# --- routes -----------------------------------------------------------------

@app.post("/auth/request-code")
def request_code(body: EmailIn):
    email = body.email.lower()
    code = f"{secrets.randbelow(1_000_000):06d}"
    with db() as conn:
        conn.execute(
            "REPLACE INTO codes (email, code_hash, expires_at, attempts) VALUES (?,?,?,0)",
            (email, hash_code(email, code), time.time() + CODE_TTL_MINUTES * 60),
        )
    send_code_email(email, code)
    out = {"ok": True}
    if DEV_MODE:
        out["dev_code"] = code
    return out


@app.post("/auth/verify")
def verify(body: VerifyIn):
    email = body.email.lower()
    with db() as conn:
        row = conn.execute("SELECT * FROM codes WHERE email = ?", (email,)).fetchone()
        if row is None or row["expires_at"] < time.time():
            raise HTTPException(400, "Code expired — request a new one")
        if row["attempts"] >= 5:
            raise HTTPException(429, "Too many attempts — request a new code")
        if not hmac.compare_digest(row["code_hash"], hash_code(email, body.code)):
            conn.execute(
                "UPDATE codes SET attempts = attempts + 1 WHERE email = ?", (email,)
            )
            raise HTTPException(400, "Wrong code")
        conn.execute("DELETE FROM codes WHERE email = ?", (email,))
        user = conn.execute("SELECT * FROM users WHERE email = ?", (email,)).fetchone()
        if user is None:
            cur = conn.execute(
                "INSERT INTO users (email, created_at) VALUES (?, ?)",
                (email, datetime.now(timezone.utc).isoformat()),
            )
            user_id = cur.lastrowid
        else:
            user_id = user["id"]
    return {"token": make_token(user_id, email)}


@app.get("/me")
def me(user: sqlite3.Row = Depends(current_user)):
    with db() as conn:
        used = daily_used(conn, user["id"])
    days_left = trial_days_left(user)
    return {
        "email": user["email"],
        "plan": user["plan"],
        "daily_used": used,
        "daily_limit": FREE_DAILY_LIMIT,
        "trial_days_left": days_left,
        "trial_active": days_left > 0,
    }


@app.post("/usage/opening-identified")
def opening_identified(body: UsageIn, user: sqlite3.Row = Depends(current_user)):
    with db() as conn:
        if user["plan"] == "pro":
            return {"allowed": True, "daily_used": 0, "daily_limit": FREE_DAILY_LIMIT}
        # After the free trial the free plan gets nothing at all.
        if trial_days_left(user) <= 0:
            return {"allowed": False, "daily_used": 0, "daily_limit": 0}
        day = date.today().isoformat()
        exists = conn.execute(
            "SELECT 1 FROM usage WHERE user_id = ? AND day = ? AND opening_id = ?",
            (user["id"], day, body.opening_id),
        ).fetchone()
        used = daily_used(conn, user["id"])
        if exists:
            return {"allowed": True, "daily_used": used, "daily_limit": FREE_DAILY_LIMIT}
        if used >= FREE_DAILY_LIMIT:
            return {"allowed": False, "daily_used": used, "daily_limit": FREE_DAILY_LIMIT}
        conn.execute(
            "INSERT INTO usage (user_id, day, opening_id) VALUES (?,?,?)",
            (user["id"], day, body.opening_id),
        )
        return {"allowed": True, "daily_used": used + 1, "daily_limit": FREE_DAILY_LIMIT}


@app.post("/billing/webhook")
def billing_webhook(payload: dict, authorization: str = Header(default="")):
    # RevenueCat sends the configured secret in the Authorization header.
    expected = os.environ.get("RC_WEBHOOK_SECRET", "")
    if expected and not hmac.compare_digest(authorization, f"Bearer {expected}"):
        raise HTTPException(401, "Bad webhook secret")
    event = payload.get("event", payload)
    email = (event.get("app_user_id") or "").lower()
    ev_type = event.get("type", "")
    if not email:
        raise HTTPException(400, "Missing app_user_id")
    plan = "pro" if ev_type in (
        "INITIAL_PURCHASE", "RENEWAL", "UNCANCELLATION", "PRODUCT_CHANGE",
    ) else "free" if ev_type in ("CANCELLATION", "EXPIRATION") else None
    if plan is None:
        return {"ok": True, "ignored": ev_type}
    with db() as conn:
        conn.execute("UPDATE users SET plan = ? WHERE email = ?", (plan, email))
    return {"ok": True, "plan": plan}


@app.get("/progress")
def get_progress(user: sqlite3.Row = Depends(current_user)):
    with db() as conn:
        row = conn.execute(
            "SELECT data FROM progress WHERE user_id = ?", (user["id"],)
        ).fetchone()
    return json.loads(row["data"]) if row else {}


@app.put("/progress")
def put_progress(body: ProgressIn, user: sqlite3.Row = Depends(current_user)):
    with db() as conn:
        conn.execute(
            "REPLACE INTO progress (user_id, data) VALUES (?, ?)",
            (user["id"], json.dumps(body.data, ensure_ascii=False)),
        )
    return {"ok": True}
