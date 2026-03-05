import time
import uuid
import loop_db
from run_local_pipeline import capture_ogs_session, analyze_with_openai, SCHEMA_PATH, OPENAI_API_KEY
import json

def get_schema():
    with open(SCHEMA_PATH, "r", encoding="utf-8") as f:
        return json.load(f)

def run_loop():
    print("Starting Continuous Go Mechanics Bot Loop...")
    loop_db.init_db()
    schema = get_schema()
    
    while True:
        try:
            target_state = loop_db.get_target_state()
            if target_state == 'paused':
                loop_db.update_status('Paused by User', 'Waiting for start signal...')
                time.sleep(2)
                continue

            loop_db.update_status('Loop Started', 'Starting a new iteration')
            job_id = str(uuid.uuid4())[:8]
            
            # Phase 1: Capture
            loop_db.update_status('Capturing', 'Navigating OGS to find generic UI structures')
            print(f"[{job_id}] capturing OGS session...")
            screenshot_paths = capture_ogs_session()
            if not screenshot_paths:
                print("Capture failed, retrying in 10s")
                loop_db.update_status('Idle (Error)', 'Capture failed, retrying soon...')
                time.sleep(10)
                continue
                
            loop_db.add_feature_metric('discovered')
            
            # Phase 2: Analysis
            loop_db.update_status('Analyzing', 'Waiting for OpenAI Vision to generate Feature Report')
            print(f"[{job_id}] Analyzing screenshots with OpenAI...")
            report_str = analyze_with_openai(screenshot_paths, schema)
            
            feature_name = "Unknown Feature"
            try:
                report_data = json.loads(report_str.strip())
                feature_name = report_data.get('feature', {}).get('name', 'Generic Feature')
                loop_db.add_feature_metric('analyzed')
                loop_db.log_feature(job_id, feature_name, 'analyzed')
            except Exception as e:
                print(f"[{job_id}] Failed to parse report:", e)
                loop_db.update_status('Idle (Error)', f'Analysis parsing failed: {e}')
                time.sleep(10)
                continue
                
            loop_db.update_status('Analysis Complete', f'Discovered: {feature_name}')
            time.sleep(2)
                
            # Phase 3: Implementation
            loop_db.update_status('Implementing', f'Gravity is writing code for: {feature_name}')
            print(f"[{job_id}] Mocking implementation phase for {feature_name}...")
            # Here we fake the time it takes gravity to code the feature. 
            time.sleep(15) 
            
            loop_db.add_feature_metric('implemented')
            loop_db.log_feature(job_id, feature_name, 'implemented')
            
            # End of Iteration
            loop_db.update_status('Sleeping', 'Iteration complete, resting before next run')
            loop_db.increment_iteration()
            print(f"[{job_id}] Iteration complete. Sleeping 15s.")
            time.sleep(15)
            
        except KeyboardInterrupt:
            print("Loop interrupted by user.")
            loop_db.update_status('Offline', 'Bot stopped by user')
            break
        except Exception as e:
            print(f"Unexpected error in loop: {e}")
            loop_db.update_status('Idle (Error)', f'Unexpected error: {e}')
            time.sleep(15)

if __name__ == "__main__":
    if not OPENAI_API_KEY or OPENAI_API_KEY == "...":
         print("ERROR: Please set OPENAI_API_KEY in run_local_pipeline.py first.")
    else:
         run_loop()
