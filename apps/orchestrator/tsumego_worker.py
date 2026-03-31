import sys
import os
import time

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from database import SessionLocal
from models import (
    TsumegoLicense, TsumegoSource, TsumegoCollection, TsumegoPuzzle, TsumegoArtifact
)
from tsumego.ogs import OGSConnector

def run_ingestion():
    db = SessionLocal()
    print("Starting Tsumego Ingestion Worker...")

    # 1. Setup Source & License if they don't exist
    license_id = "per-item-unknown"
    lic = db.query(TsumegoLicense).filter_by(id=license_id).first()
    if not lic:
        lic = TsumegoLicense(
            id=license_id,
            name="Per Item (Unknown/OGS Public)",
            allows_commercial=False,
            allows_derivatives=False,
            allows_redistribution=False,
            requires_attribution=True,
            notes="Stored for internal testing. Needs explicit check before public export."
        )
        db.add(lic)
    
    source_key = "ogs"
    src = db.query(TsumegoSource).filter_by(key=source_key).first()
    if not src:
        src = TsumegoSource(
            key=source_key,
            name="Online Go Server (OGS)",
            base_url="https://online-go.com/api/v1",
            default_license_id=license_id,
            connector_class="tsumego.ogs.OGSConnector"
        )
        db.add(src)
    db.commit()

    # 2. Run connector API logic
    connector = OGSConnector()
    print("Fetching OGS collections...")
    # Setup 4 main collections for different problem types
    collections = [
        {"id": "279", "name": "Cho Chikun's Encyclopedia of Life and Death - Elementary", "type": "life_and_death"},
        {"id": "5831", "name": "Tesujis for Separating", "type": "tesuji"},
        {"id": "5821", "name": "Bozulich — Get Strong at the Endgame", "type": "endgame"},
        {"id": "3588", "name": "Capturing Technique 1", "type": "semeai"}
    ]
    
    for coll_data in collections:
        cid = coll_data["id"]
        c_name = coll_data["name"]
        
        coll_db = db.query(TsumegoCollection).filter_by(source_key=source_key, source_collection_id=cid).first()
        if not coll_db:
            coll_db = TsumegoCollection(
                source_key=source_key,
                source_collection_id=cid,
                name=c_name
            )
            db.add(coll_db)
            db.commit()
        db.refresh(coll_db)

        print(f"Fetching puzzle list for collection {c_name}...")
        test_puzzle_ids = connector.list_puzzles(cid)
        print(f"Found {len(test_puzzle_ids)} puzzles in collection.")
        
        for pid in test_puzzle_ids:
            try:
                print(f"Fetching puzzle {pid}...")
                puzzle_data = connector.fetch_puzzle(pid)
                
                # Deduplication hashes
                pos_hash = connector.compute_position_hash(puzzle_data.board)
                sol_hash = "dummy-eval-hash" # We don't have standard sgf parsing in OGS naive API yet
                
                # Check exist
                p_db = db.query(TsumegoPuzzle).filter_by(source_key=source_key, source_puzzle_id=pid).first()
                if not p_db:
                    # Update normalized_json goal_type to match the collection assignment
                    p_dict = puzzle_data.dict()
                    p_dict["goal_type"] = coll_data["type"]
                    
                    p_db = TsumegoPuzzle(
                        collection_id=coll_db.id,
                        source_key=source_key,
                        source_puzzle_id=pid,
                        source_url=puzzle_data.source_url,
                        license_id=connector.determine_license(puzzle_data) or license_id,
                        position_hash=pos_hash,
                        solution_hash=sol_hash,
                        board_width=puzzle_data.board.width,
                        board_height=puzzle_data.board.height,
                        to_play=puzzle_data.board.to_play,
                        goal_type=coll_data["type"],
                        parse_status="success",
                        normalized_json=p_dict
                    )
                    db.add(p_db)
                    db.commit()
                    print(f"Saved puzzle {pid} to DB successfully with type {coll_data['type']}!")
                else:
                    print(f"Puzzle {pid} already exists in DB.")
                    
            except Exception as e:
                print(f"Error fetching {pid}: {e}")
            
            time.sleep(1) # rate limit

    db.close()
    print("Ingestion finished.")

if __name__ == "__main__":
    run_ingestion()
