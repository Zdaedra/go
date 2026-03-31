import asyncio
import json
import logging
import os
import time
from typing import Dict, Any, Optional

from api.schemas import AnalyzeRequest, AnalyzeResponse, EngineMetadata, AnalysisResult, CandidateMove

logger = logging.getLogger("katago-engine.manager")

KATAGO_BINARY = os.getenv("KATAGO_BINARY", "katago")
KATAGO_NETWORK = os.getenv("KATAGO_NETWORK", "/opt/katago/models/network.bin.gz")
KATAGO_CONFIG = os.getenv("KATAGO_CONFIG", "/opt/katago/config.cfg")

class KataGoProcessManager:
    def __init__(self):
        self.proc: Optional[asyncio.subprocess.Process] = None
        self.pending_futures: Dict[str, asyncio.Future] = {}
        self.lock = asyncio.Lock()
        self.active_request_id: Optional[str] = None
        
        self.restart_count = 0
        self.health_state = "unavailable"
        self.uptime_start = time.time()
        self.last_restart_at = None
        self.last_watchdog_success_at = None
        
        # Latest-Wins Slot Queuing
        self.slot_queue: Dict[str, AnalyzeRequest] = {}
        self.slot_futures: Dict[str, asyncio.Future] = {}

    async def start(self):
        async with self.lock:
            if self.proc and self.proc.returncode is None:
                return
            logger.info(f"Starting KataGo process: {KATAGO_BINARY}")
            self.proc = await asyncio.create_subprocess_exec(
                KATAGO_BINARY, "analysis",
                "-model", KATAGO_NETWORK,
                "-config", KATAGO_CONFIG,
                stdin=asyncio.subprocess.PIPE,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            self.health_state = "healthy"
            self.restart_count += 1
            self.last_restart_at = time.time()
            # Start background reader
            asyncio.create_task(self._stdout_reader())
            asyncio.create_task(self._stderr_reader())

    async def restart(self):
        self.health_state = "restarting"
        async with self.lock:
            if self.proc and self.proc.returncode is None:
                self.proc.terminate()
                try:
                    await asyncio.wait_for(self.proc.wait(), timeout=5.0)
                except asyncio.TimeoutError:
                    self.proc.kill()
        
        # Fail all pending futures
        for req_id, future in self.pending_futures.items():
            if not future.done():
                future.set_exception(RuntimeError("Engine restart interrupted analysis"))
        self.pending_futures.clear()
        
        await self.start()

    async def _stdout_reader(self):
        while self.proc and self.proc.returncode is None:
            try:
                line = await self.proc.stdout.readline()
                if not line:
                    break
                line_str = line.decode('utf-8').strip()
                if not line_str:
                    continue
                    
                resp = json.loads(line_str)
                req_id = resp.get("id")
                if req_id and req_id in self.pending_futures:
                    fut = self.pending_futures.pop(req_id)
                    if not fut.done():
                        fut.set_result(resp)
            except Exception as e:
                logger.error(f"Error reading stdout: {str(e)}")
        
        logger.warning("KataGo stdout reader exited.")
        if self.health_state != "restarting":
            self.health_state = "degraded"

    async def _stderr_reader(self):
        while self.proc and self.proc.returncode is None:
            try:
                line = await self.proc.stderr.readline()
                if not line:
                    break
                # KataGo outputs useful loading info or search info to stderr
            except Exception:
                pass

    def _map_ruleset(self, req: AnalyzeRequest) -> Dict[str, str]:
        rules = {
            "japanese": {"koRule": "SIMPLE", "scoringRule": "TERRITORY", "taxRule": "NONE"},
            "chinese": {"koRule": "KO", "scoringRule": "AREA", "taxRule": "NONE"},
            "tromp-taylor": {"koRule": "KO", "scoringRule": "AREA", "taxRule": "NONE"},
            "aga": {"koRule": "SITUATIONAL", "scoringRule": "AREA", "taxRule": "NONE"}
        }
        return rules.get(req.ruleset, rules["japanese"])

    def _normalize_moves(self, req: AnalyzeRequest) -> list:
        # Converts external ["C3", "D4"] to [["B", "C3"], ["W", "D4"]] internally
        internal_moves = []
        
        # Start with side_to_move if provided
        current_color = req.side_to_move
        
        # If not provided, mechanical derivation is expected from previous logic, but here we can 
        # default to B if moves_list implies it
        if not current_color:
            current_color = "B" 
            
        return internal_moves  # For v1, the frontend sends board_state in initial_position implicitly

    async def process_analysis(self, req: AnalyzeRequest) -> AnalyzeResponse:
        # Latest-Wins Queuing Logic (Only 1 active analyze per slot allowed)
        slot = req.analysis_slot
        
        async with self.lock:
            if slot in self.slot_futures:
                # Cancel the pending one
                old_fut = self.slot_futures[slot]
                if not old_fut.done():
                    old_fut.cancel()
                    
            fut = asyncio.Future()
            self.slot_futures[slot] = fut
            self.slot_queue[slot] = req
            
        try:
            # Wait for execution turn
            # In V1 we process immediately since Single Active Context is mapped to horizontal replicas
            # but if we wanted serial queueing, we'd use an asyncio.Queue worker per replica.
            # To keep it simple: we submit directly to the engine and await.
            
            if self.health_state != "healthy":
                await self.start()
                
            rules = self._map_ruleset(req)
            
            # Construct JSON Query for KataGo
            katago_query = {
                "id": req.request_id,
                "rules": rules,
                "komi": req.komi,
                "boardXSize": req.board_size,
                "boardYSize": req.board_size,
                "maxVisits": req.max_visits,
                "includeOwnership": req.include_ownership,
                "reportDuringSearchEvery": 0 # No intermediate updates mapped to v1.0 api
            }
            
            # initial_position overlaps are already validated by Pydantic
            if req.initial_position:
                katago_query["initialStones"] = []
                for point in req.initial_position.black:
                    katago_query["initialStones"].append(["B", point])
                for point in req.initial_position.white:
                    katago_query["initialStones"].append(["W", point])
                    
            # Set moves
            katago_query["moves"] = [] # In v1, stateless initialStones handles it usually
            
            # Setup Future
            engine_fut = asyncio.Future()
            self.pending_futures[req.request_id] = engine_fut
            self.active_request_id = req.request_id
            
            query_str = json.dumps(katago_query) + "\\n"
            self.proc.stdin.write(query_str.encode('utf-8'))
            await self.proc.stdin.drain()
            
            t0 = time.time()
            try:
                engine_result = await asyncio.wait_for(engine_fut, timeout=req.time_budget_ms / 1000.0)
            except asyncio.TimeoutError:
                # Handle timeout: remove from pending, restart engine
                self.pending_futures.pop(req.request_id, None)
                asyncio.create_task(self.restart()) # Escalate
                raise TimeoutError("Engine timed out during analysis")
                
            t1 = time.time()
            timing_ms = int((t1 - t0) * 1000)
            
            # Map KataGo output to DTO
            root_info = engine_result.get("rootInfo", {})
            raw_winrate = root_info.get("winrate", 0.5)
            raw_score = root_info.get("scoreLead", 0.0)
            
            # KataGo returns scores/winrates from perspective of player to move.
            # We strictly normalize to Black-Centric.
            # Determine who was to move
            is_black_turn = True
            if root_info.get("currentPlayer") == "W":
                is_black_turn = False
                
            black_winrate = raw_winrate if is_black_turn else (1.0 - raw_winrate)
            black_score = raw_score if is_black_turn else -raw_score
            
            top_moves = []
            for m in engine_result.get("moveInfos", [])[:req.max_top_moves]:
                m_winrate = m.get("winrate", 0.5)
                m_score = m.get("scoreLead", 0)
                m_lcb = m.get("lcb", m_winrate)
                
                tm = CandidateMove(
                    move=m.get("move", "PASS"),
                    order=m.get("order", 0),
                    winrate_black=m_winrate if is_black_turn else (1.0 - m_winrate),
                    lcb_winrate_black=m_lcb if is_black_turn else (1.0 - m_lcb),
                    score_lead_black=m_score if is_black_turn else -m_score,
                    utility=m.get("utility", 0.0),
                    visits=m.get("visits", 0),
                    policy=m.get("prior", 0.0),
                    is_policy_fallback=False, 
                    pv=m.get("pv", [])
                )
                top_moves.append(tm)
                
            raw_ownership = engine_result.get("ownership")
            analysis_res = AnalysisResult(
                winrate_black=black_winrate,
                score_lead_black=black_score,
                visits=root_info.get("visits", 0),
                ownership_map=raw_ownership if req.include_ownership and raw_ownership else None,
                top_moves=top_moves
            )
            
            # Deterministic Hash Generation (mocked hash for v1 scaffold)
            hash_str = f"{req.board_size}x{req.board_size}:{req.ruleset}:{req.komi}:{req.side_to_move or 'B'}"
            
            resp = AnalyzeResponse(
                status="success",
                request_id=req.request_id,
                position_hash=hash_str,
                engine_metadata=EngineMetadata(
                    version="1.14.0",
                    model_name=KATAGO_NETWORK.split("/")[-1],
                    timing_ms=timing_ms,
                    degraded_mode=False,
                    cache_hit=False
                ),
                analysis=analysis_res
            )
            
            return resp
            
        finally:
            self.active_request_id = None
            async with self.lock:
                self.slot_futures.pop(slot, None)

process_manager = KataGoProcessManager()
