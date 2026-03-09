import psycopg2
from psycopg2.extras import RealDictCursor
import datetime
import json
import os
from pathlib import Path

PG_DSN = os.environ.get('PG_DSN', 'postgresql://postgres:postgres@localhost:5432/gomech')

def get_connection():
    return psycopg2.connect(PG_DSN, cursor_factory=RealDictCursor)

def init_db():
    print(f"Initializing PostgreSQL database...")
    with get_connection() as conn:
        with conn.cursor() as cursor:
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
        conn.commit()
            
        with conn.cursor() as cursor:
            # In case the table exists but is missing target_state (migration)
            try:
                cursor.execute("ALTER TABLE metrics ADD COLUMN target_state TEXT DEFAULT 'paused'")
                conn.commit()
            except psycopg2.errors.DuplicateColumn:
                conn.rollback() # Column already exists
            except psycopg2.Error:
                conn.rollback()
            
        with conn.cursor() as cursor:
            # Table for history of captured features to avoid repetition
            cursor.execute('''
            CREATE TABLE IF NOT EXISTS feature_history (
                id SERIAL PRIMARY KEY,
                job_id TEXT,
                feature_name TEXT,
                status TEXT,
                timestamp TEXT
            )
            ''')
            
            # Check if row 1 exists in metrics, if not create it
            cursor.execute("SELECT id FROM metrics WHERE id = 1")
            if not cursor.fetchone():
                now = datetime.datetime.now().isoformat()
                cursor.execute('''
                INSERT INTO metrics (id, status, status_message, start_time, last_ping_time, target_state) 
                VALUES (1, 'Idle', 'System initializing', %s, %s, 'paused')
                ''', (now, now))
                
        conn.commit()

def set_target_state(state: str):
    with get_connection() as conn:
        with conn.cursor() as cursor:
            cursor.execute('UPDATE metrics SET target_state = %s WHERE id = 1', (state,))
            conn.commit()

def get_target_state() -> str:
    with get_connection() as conn:
        with conn.cursor() as cursor:
            cursor.execute('SELECT target_state FROM metrics WHERE id = 1')
            row = cursor.fetchone()
            return row['target_state'] if row else 'paused'

def update_status(status: str, message: str = ""):
    with get_connection() as conn:
        with conn.cursor() as cursor:
            now = datetime.datetime.now().isoformat()
            cursor.execute('''
            UPDATE metrics 
            SET status = %s, status_message = %s, last_ping_time = %s
            WHERE id = 1
            ''', (status, message, now))
            conn.commit()

def increment_iteration():
    with get_connection() as conn:
        with conn.cursor() as cursor:
            cursor.execute('UPDATE metrics SET loop_iterations = loop_iterations + 1 WHERE id = 1')
            conn.commit()

def add_feature_metric(metric_type: str):
    # metric_type: 'discovered', 'analyzed', 'implemented'
    col_name = f"features_{metric_type}"
    with get_connection() as conn:
        with conn.cursor() as cursor:
            cursor.execute(f'UPDATE metrics SET {col_name} = {col_name} + 1 WHERE id = 1')
            
            # Naive percent increment for cool factor
            if metric_type == 'implemented':
                 cursor.execute('UPDATE metrics SET estimated_percent_copied = LEAST(estimated_percent_copied + 1, 100) WHERE id = 1')
            conn.commit()

def log_feature(job_id: str, feature_name: str, status: str):
    with get_connection() as conn:
        with conn.cursor() as cursor:
            now = datetime.datetime.now().isoformat()
            cursor.execute('''
            INSERT INTO feature_history (job_id, feature_name, status, timestamp)
            VALUES (%s, %s, %s, %s)
            ''', (job_id, feature_name, status, now))
            conn.commit()

def get_dashboard_data():
    with get_connection() as conn:
        with conn.cursor() as cursor:
            cursor.execute("SELECT * FROM metrics WHERE id = 1")
            metrics = dict(cursor.fetchone() or {})
            
            cursor.execute("SELECT * FROM feature_history ORDER BY id DESC LIMIT 10")
            history = [dict(row) for row in cursor.fetchall()]
            
            return {
                "metrics": metrics,
                "recent_features": history
            }

if __name__ == "__main__":
    init_db()
