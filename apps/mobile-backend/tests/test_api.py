import os
import tempfile

os.environ["DB_PATH"] = os.path.join(tempfile.mkdtemp(), "test.db")
os.environ["DEV_MODE"] = "1"
os.environ["APP_SECRET"] = "test-secret"
os.environ["RC_WEBHOOK_SECRET"] = "rc-secret"
os.environ["FREE_DAILY_LIMIT"] = "3"

from fastapi.testclient import TestClient  # noqa: E402

from app.main import app  # noqa: E402

client = TestClient(app)
EMAIL = "player@example.com"


def sign_in(email=EMAIL) -> str:
    res = client.post("/auth/request-code", json={"email": email})
    assert res.status_code == 200
    code = res.json()["dev_code"]
    res = client.post("/auth/verify", json={"email": email, "code": code})
    assert res.status_code == 200
    return res.json()["token"]


def auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def test_wrong_code_rejected():
    client.post("/auth/request-code", json={"email": EMAIL})
    res = client.post("/auth/verify", json={"email": EMAIL, "code": "000000"})
    assert res.status_code == 400


def test_sign_in_and_me():
    token = sign_in()
    res = client.get("/me", headers=auth(token))
    assert res.status_code == 200
    body = res.json()
    assert body["email"] == EMAIL
    assert body["plan"] == "free"
    assert body["daily_limit"] == 3


def test_daily_limit_and_dedupe():
    token = sign_in()
    # Three distinct openings are allowed.
    for op in ("tengen/curveball", "hoshi/black-boomerang", "tengen/sword"):
        res = client.post(
            "/usage/opening-identified", json={"opening_id": op}, headers=auth(token)
        )
        assert res.json()["allowed"] is True
    # Repeat of an already-counted opening stays free.
    res = client.post(
        "/usage/opening-identified",
        json={"opening_id": "tengen/curveball"},
        headers=auth(token),
    )
    assert res.json()["allowed"] is True
    assert res.json()["daily_used"] == 3
    # A fourth distinct opening is blocked.
    res = client.post(
        "/usage/opening-identified",
        json={"opening_id": "takamoku/boots"},
        headers=auth(token),
    )
    assert res.json()["allowed"] is False


def test_webhook_upgrades_and_unlocks():
    token = sign_in()
    res = client.post(
        "/billing/webhook",
        json={"event": {"app_user_id": EMAIL, "type": "INITIAL_PURCHASE"}},
        headers={"Authorization": "Bearer rc-secret"},
    )
    assert res.status_code == 200 and res.json()["plan"] == "pro"
    res = client.get("/me", headers=auth(token))
    assert res.json()["plan"] == "pro"
    # Pro users are never limited.
    res = client.post(
        "/usage/opening-identified",
        json={"opening_id": "territorial/sansan"},
        headers=auth(token),
    )
    assert res.json()["allowed"] is True
    # Bad webhook secret is rejected.
    res = client.post(
        "/billing/webhook",
        json={"event": {"app_user_id": EMAIL, "type": "CANCELLATION"}},
        headers={"Authorization": "Bearer wrong"},
    )
    assert res.status_code == 401


def test_trial_expiry_hard_lock():
    import sqlite3
    from datetime import datetime, timedelta, timezone

    email = "expired@example.com"
    token = sign_in(email)
    # Age the account past the 7-day trial.
    conn = sqlite3.connect(os.environ["DB_PATH"])
    old = (datetime.now(timezone.utc) - timedelta(days=8)).isoformat()
    conn.execute("UPDATE users SET created_at = ? WHERE email = ?", (old, email))
    conn.commit()
    conn.close()

    res = client.get("/me", headers=auth(token))
    assert res.json()["trial_active"] is False
    res = client.post(
        "/usage/opening-identified",
        json={"opening_id": "tengen/curveball"},
        headers=auth(token),
    )
    body = res.json()
    assert body["allowed"] is False and body["daily_limit"] == 0
    # Purchase unlocks it again.
    client.post(
        "/billing/webhook",
        json={"event": {"app_user_id": email, "type": "INITIAL_PURCHASE"}},
        headers={"Authorization": "Bearer rc-secret"},
    )
    res = client.post(
        "/usage/opening-identified",
        json={"opening_id": "tengen/curveball"},
        headers=auth(token),
    )
    assert res.json()["allowed"] is True


def test_progress_roundtrip():
    token = sign_in("second@example.com")
    res = client.put(
        "/progress",
        json={"data": {"learned": ["tengen/curveball/1"]}},
        headers=auth(token),
    )
    assert res.status_code == 200
    res = client.get("/progress", headers=auth(token))
    assert res.json() == {"learned": ["tengen/curveball/1"]}
