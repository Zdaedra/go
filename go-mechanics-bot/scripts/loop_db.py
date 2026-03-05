import sqlite3
import datetime
import json
import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
DB_PATH = BASE_DIR / "loop_metrics.db"

def get_connection():
    return sqlite3.connect(DB_PATH)

def init_db():
    print(f"Initializing database at {DB_PATH}")
    with get_connection() as conn:
        cursor = conn.cursor()
        
        # Table for overall loop metrics
        cursor.execute('''
        CREATE TABLE IF NOT EXISTS metrics (
            id INTEGER PRIMARY KEY DEFAULT 1,
            status TEXT,
            status_message TEXT,
            loop_iterations INTEGER DEFAULT 0,
            features_discovered INTEGER DEFAULT 0,
            features_analyzed INTEGER DEFAULT 0,
            features_implemented INTEGER DEFAULT 0,
            start_time TEXT,
            last_ping_time TEXT,
            estimated_percent_copied INTEGER DEFAULT 0,
            target_state TEXT DEFAULT 'paused'
        )
        ''')
        
        # In case the table exists but is missing target_state (migration)
        try:
            cursor.execute("ALTER TABLE metrics ADD COLUMN target_state TEXT DEFAULT 'paused'")
        except sqlite3.OperationalError:
            pass # Column already exists
        
        # Table for history of captured features to avoid repetition
        cursor.execute('''
        CREATE TABLE IF NOT EXISTS feature_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            job_id TEXT,
            feature_name TEXT,
            status TEXT, -- 'captured', 'analyzed', 'implemented'
            timestamp TEXT
        )
        ''')
        
        # Check if row 1 exists in metrics, if not create it
        cursor.execute("SELECT id FROM metrics WHERE id = 1")
        if not cursor.fetchone():
            now = datetime.datetime.now().isoformat()
            cursor.execute('''
            INSERT INTO metrics (id, status, status_message, start_time, last_ping_time, target_state) 
            VALUES (1, 'Idle', 'System initializing', ?, ?, 'paused')
            ''', (now, now))
            
        conn.commit()

def set_target_state(state: str):
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute('UPDATE metrics SET target_state = ? WHERE id = 1', (state,))
        conn.commit()

def get_target_state() -> str:
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute('SELECT target_state FROM metrics WHERE id = 1')
        row = cursor.fetchone()
        return row[0] if row else 'paused'

def update_status(status: str, message: str = ""):
    with get_connection() as conn:
        cursor = conn.cursor()
        now = datetime.datetime.now().isoformat()
        cursor.execute('''
        UPDATE metrics 
        SET status = ?, status_message = ?, last_ping_time = ?
        WHERE id = 1
        ''', (status, message, now))
        conn.commit()

def increment_iteration():
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute('UPDATE metrics SET loop_iterations = loop_iterations + 1 WHERE id = 1')
        conn.commit()

def add_feature_metric(metric_type: str):
    # metric_type: 'discovered', 'analyzed', 'implemented'
    col_name = f"features_{metric_type}"
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(f'UPDATE metrics SET {col_name} = {col_name} + 1 WHERE id = 1')
        
        # Naive percent increment for cool factor
        if metric_type == 'implemented':
             cursor.execute('UPDATE metrics SET estimated_percent_copied = MIN(estimated_percent_copied + 1, 100) WHERE id = 1')
        conn.commit()

def log_feature(job_id: str, feature_name: str, status: str):
    with get_connection() as conn:
        cursor = conn.cursor()
        now = datetime.datetime.now().isoformat()
        cursor.execute('''
        INSERT INTO feature_history (job_id, feature_name, status, timestamp)
        VALUES (?, ?, ?, ?)
        ''', (job_id, feature_name, status, now))
        conn.commit()

def get_dashboard_data():
    with get_connection() as conn:
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        
        cursor.execute("SELECT * FROM metrics WHERE id = 1")
        metrics = dict(cursor.fetchone())
        
        cursor.execute("SELECT * FROM feature_history ORDER BY id DESC LIMIT 10")
        history = [dict(row) for row in cursor.fetchall()]
        
        return {
            "metrics": metrics,
            "recent_features": history
        }

if __name__ == "__main__":
    init_db()
