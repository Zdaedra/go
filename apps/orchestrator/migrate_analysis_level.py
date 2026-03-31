import sqlite3

try:
    conn = sqlite3.connect('orchestrator.db')
    cursor = conn.cursor()
    cursor.execute('ALTER TABLE users ADD COLUMN analysis_level INTEGER DEFAULT 3')
    conn.commit()
    print("Column added successfully.")
except sqlite3.OperationalError as e:
    print(f"Migration error or already exists: {e}")
finally:
    conn.close()
