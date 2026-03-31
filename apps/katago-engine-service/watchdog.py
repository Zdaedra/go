import asyncio
import logging
import time

from engine import process_manager
from api.schemas import AnalyzeRequest

logger = logging.getLogger("katago-engine.watchdog")

async def watchdog_loop():
    logger.info("Starting KataGo Watchdog Escalation Loop...")
    
    # Give the engine time to start initially
    await asyncio.sleep(5)
    
    backoff_escalation = [1, 2, 5, 15]
    retry_ladder_idx = 0
    
    while True:
        try:
            # Only run synthetic checks if the engine isn't already deeply analyzing something
            if process_manager.active_request_id is None:
                # 3-move synthetic SGF test
                probe = AnalyzeRequest(
                    request_id="watchdog_probe",
                    analysis_slot="watchdog",
                    board_size=9,
                    max_visits=2,
                    time_budget_ms=3000,
                    include_ownership=False
                )
                
                logger.debug("Dispatching Watchdog probe...")
                await process_manager.process_analysis(probe)
                
                # Success
                process_manager.last_watchdog_success_at = time.time()
                retry_ladder_idx = 0
                
            await asyncio.sleep(15)  # Nominal health check interval
            
        except Exception as e:
            logger.error(f"Watchdog probe failed: {str(e)}")
            
            # Subprocess Restart Ladder
            wait_time = backoff_escalation[min(retry_ladder_idx, len(backoff_escalation)-1)]
            logger.warning(f"Escalation {retry_ladder_idx+1}: Restarting KataGo in {wait_time}s...")
            
            await asyncio.sleep(wait_time)
            await process_manager.restart()
            
            retry_ladder_idx += 1
            
            # If we max out the ladder, we could trigger sys.exit() to let Docker/K8s restart the container
            if retry_ladder_idx >= 5:
                logger.critical("Watchdog exhausted escalation ladder! Mark service unavailable.")
                process_manager.health_state = "unavailable"
