import sys
import os

# Ensure the app path is in sys.path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from database import engine
import models

def init_db():
    print("Creating Tsumego database tables...")
    # This will create tables that don't exist yet, ignoring existing ones
    models.Base.metadata.create_all(bind=engine)
    print("Done!")

if __name__ == "__main__":
    init_db()
