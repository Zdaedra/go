import sys
import os
import requests
import time

# Ensure the app path is in sys.path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from database import SessionLocal
from models import TsumegoCollection, TsumegoPuzzle
from tsumego.ogs import OGSConnector
from sqlalchemy.orm import Session

# List of known public OGS collections to ingest
# 41: Cho Chikun's Encyclopedia of Life and Death (Elementary) - Good for mix 15k to 5k
# 102: 1001 Life and Death Problems (contains a good mix)
TARGET_COLLECTIONS = [
    {"id": 41, "name": "Cho Chikun's Encyclopedia of Life and Death (Elementary)", "base_rating": 1200},
    {"id": 102, "name": "1001 Life and Death Problems", "base_rating": 1400},
    {"id": 520, "name": "Cho Chikun’s Encyclopedia of Life and Death (Part 1)", "base_rating": 1100},
    {"id": 723, "name": "Cho Chikun's Encyclopedia of Life and Death - Intermediate", "base_rating": 1600},
    {"id": 70,  "name": "Guan Zi Pu Collection Volume I (Advanced)", "base_rating": 2000},
]

def fetch_and_ingest():
    db: Session = SessionLocal()
    connector = OGSConnector()

    for col_info in TARGET_COLLECTIONS:
        ogs_col_id = col_info["id"]
        col_name = col_info["name"]
        base_rating = col_info["base_rating"]

        print(f"\n--- Ingesting Collection: {col_name} (OGS ID: {ogs_col_id}) ---")

        db_collection = db.query(TsumegoCollection).filter(
            TsumegoCollection.source_key == "ogs",
            TsumegoCollection.source_collection_id == str(ogs_col_id)
        ).first()
        if not db_collection:
            db_collection = TsumegoCollection(
                name=col_name,
                source_key="ogs",
                source_collection_id=str(ogs_col_id),
            )
            db.add(db_collection)
            db.commit()
            db.refresh(db_collection)

        # 2. Get list of all puzzle IDs from this collection
        puzzle_ids = []
        url = f"https://online-go.com/api/v1/puzzles/?collection={ogs_col_id}"
        
        while url:
            try:
                print(f"Fetching page: {url}")
                response = requests.get(url, timeout=10)
                if response.status_code == 200:
                    data = response.json()
                    for p in data.get("results", []):
                        puzzle_ids.append(str(p["id"]))
                    url = data.get("next")
                    time.sleep(0.5)  # Rate limiting
                else:
                    print(f"API Error {response.status_code} fetching collection page.")
                    break
            except Exception as e:
                print(f"Request failed: {e}")
                break

        print(f"Found {len(puzzle_ids)} puzzles in {col_name}.")

        # 3. Fetch each puzzle and insert into DB
        count_inserted = 0
        count_skipped = 0
        
        for idx, pid in enumerate(puzzle_ids):
            # Check if it already exists
            existing = db.query(TsumegoPuzzle).filter(
                TsumegoPuzzle.source_key == "ogs",
                TsumegoPuzzle.source_puzzle_id == str(pid)
            ).first()
            if existing:
                count_skipped += 1
                if count_skipped % 50 == 0:
                    print(f"  Skipped {count_skipped} existing puzzles...")
                continue

            try:
                norm_puzzle = connector.fetch_puzzle(pid)
                
                # Estimate a puzzle_rating based on the base rating, with a slight drift so they aren't all exactly identical.
                # E.g. base_rating 1200 + (10 * offset), just to give some spread to the Mix algorithm.
                assigned_rating = base_rating + (idx % 20) * 10
                
                # Distribute the massive Guan Zi Pu collection into our empty Frontend categories
                assigned_group = norm_puzzle.goal_type
                if ogs_col_id == 70:
                    if idx < 135: assigned_group = "endgame"
                    elif idx < 270: assigned_group = "tesuji"
                    elif idx < 405: assigned_group = "semeai"
                    else: assigned_group = "advanced"

                db_puzzle = TsumegoPuzzle(
                    source_key="ogs",
                    source_puzzle_id=str(pid),
                    board_width=norm_puzzle.board.width,
                    board_height=norm_puzzle.board.height,
                    to_play=norm_puzzle.board.to_play,
                    goal_type=assigned_group,
                    normalized_json=norm_puzzle.dict(),
                    problem_rating=assigned_rating,
                    collection_id=db_collection.id
                )
                db.add(db_puzzle)
                db.commit()
                count_inserted += 1
                if count_inserted % 50 == 0:
                    print(f"  Inserted {count_inserted} puzzles...")
                
                time.sleep(0.2) # Hard rate limit for OGS API
                
            except Exception as e:
                db.rollback()
                print(f"Failed to ingest puzzle {pid}: {e}")

        print(f"Completed Collection '{col_name}': {count_inserted} newly inserted, {count_skipped} skipped.")

    db.close()

if __name__ == "__main__":
    fetch_and_ingest()
