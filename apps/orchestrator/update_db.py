import sys
import os

# Set up PYTHONPATH so we can import models and database
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from database import SessionLocal
import models

def run():
    db = SessionLocal()
    users = db.query(models.User).all()
    count = 0
    for u in users:
        u.rating = 500
        u.rank = "25k"
        count += 1
    db.commit()
    print(f"Updated {count} test users globally to 500 rating / 25k rank.")

if __name__ == "__main__":
    run()
