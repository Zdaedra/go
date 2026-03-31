import React, { useState, useEffect, useRef, useMemo } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { motion, AnimatePresence } from 'framer-motion';
import { Flag, Cpu, ChevronLeft, ChevronRight, Activity, Undo2, Play, Users, Clock, AlertCircle, LineChart, X, User } from 'lucide-react';
import { GoBoard } from '../../components/GoBoard';

const xLabels = "ABCDEFGHJKLMNOPQRST";
const toCoordinates = (r, c, boardSize) => {
    const x = xLabels[c];
    const y = boardSize - r;
    return `${x}${y}`;
};

const createEmptyBoard = (size) => Array(size).fill(null).map(() => Array(size).fill(null));

const API_BASE_URL = typeof window !== 'undefined'
    ? `${window.location.protocol}//${window.location.hostname}:8800`
    : 'http://89.167.122.76:8800';

const parseKataGoMove = (moveStr, currentBoardSize) => {
    if (!moveStr || moveStr.toUpperCase() === "PASS" || moveStr.toLowerCase() === "resign") return null;
    const xIndex = xLabels.indexOf(moveStr[0].toUpperCase());
    const y = parseInt(moveStr.substring(1), 10);
    const r = currentBoardSize - y;
    const c = xIndex;
    return { r, c };
};

function applyGoRules(boardState, color, row, col) {
    // simplified stub - server is authoritative
    const newBoard = boardState.map(r => [...r]);
    newBoard[row][col] = color;
    return { newBoard, captured: 0 };
}

export default function PlayMatch() {
    const router = useRouter();
    const { match_id } = router.query;

    const [gameState, setGameState] = useState('connecting'); // connecting, playing, finished
    const [boardSize, setBoardSize] = useState(19);

    // --- GAME STATE ---
    const [board, setBoard] = useState(createEmptyBoard(19));
    const [myColor, setMyColor] = useState(null);
    const [blackPlayer, setBlackPlayer] = useState('Opponent');
    const [whitePlayer, setWhitePlayer] = useState('Opponent');
    const [currentPlayer, setCurrentPlayer] = useState('black');
    const [moveCount, setMoveCount] = useState(0);
    const [winner, setWinner] = useState(null);
    const [winReason, setWinReason] = useState(null);
    const [moveHistory, setMoveHistory] = useState([]); // [{m: 'D10', c: 'white', p: 'w', r, c}]

    const [captures, setCaptures] = useState({ black: 0, white: 0 });
    const [timers, setTimers] = useState({ black: 0, white: 0 });
    const [lastMove, setLastMove] = useState(null);

    const [socket, setSocket] = useState(null);
    const [boardPx, setBoardPx] = useState(800);
    const [analysisData, setAnalysisData] = useState([]);
    const [showAnalysis, setShowAnalysis] = useState(false);

    // --- MISTAKE TRAINER STATE ---
    const boardHistoryListRef = useRef([JSON.stringify(createEmptyBoard(19))]);
    const [reviewMistakes, setReviewMistakes] = useState([]);
    const [currentMistakeIndex, setCurrentMistakeIndex] = useState(0);
    const [isAnalyzingMistakes, setIsAnalyzingMistakes] = useState(false);
    const [mistakeTrainerBoard, setMistakeTrainerBoard] = useState(null);
    const [trainerFeedback, setTrainerFeedback] = useState(null);
    const [trainerAttemptCount, setTrainerAttemptCount] = useState(0);
    const [showTrainerOptions, setShowTrainerOptions] = useState(false);
    const [isGeneratingTsumego, setIsGeneratingTsumego] = useState(false);

    useEffect(() => {
        document.body.classList.add('theater-running');
        return () => document.body.classList.remove('theater-running');
    }, []);

    useEffect(() => {
        const updateSize = () => {
            const availableHeight = window.innerHeight - 200;
            const availableWidth = window.innerWidth - 600;
            const size = Math.max(400, Math.min(availableHeight, availableWidth, 900));
            setBoardPx(size);
        };
        updateSize();
        window.addEventListener('resize', updateSize);
        return () => window.removeEventListener('resize', updateSize);
    }, []);

    useEffect(() => {
        if (!match_id) return;
        const token = localStorage.getItem('token');
        if (!token) return;

        const ws = new WebSocket(`ws://89.167.122.76:8800/v1/ws/matches/${match_id}?token=${token}`);
        setSocket(ws);

        ws.onopen = () => console.log("Connected to match room");

        ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            if (data.type === 'game_start') {
                setGameState('playing');
                const newSize = data.board_size || 19;
                setBoardSize(newSize);
                setBoard(data.board || createEmptyBoard(newSize));
                setBlackPlayer(typeof data.black_player === 'object' ? data.black_player.username : (data.black_player || 'Black'));
                setWhitePlayer(typeof data.white_player === 'object' ? data.white_player.username : (data.white_player || 'White'));
                if (data.your_color) setMyColor(data.your_color);
                if (data.timers) setTimers(data.timers);
                if (data.captures) setCaptures(data.captures);
                if (data.current_player) setCurrentPlayer(data.current_player);
            } else if (data.type === 'move') {
                const { r, c, color, captured } = data;
                if (r !== -1 && c !== -1) {
                    setBoard(prevBoard => {
                        const newBoard = prevBoard.map(row => [...row]);
                        newBoard[r][c] = color;
                        return newBoard;
                    });

                    setMoveHistory(prev => [...prev, {
                        m: toCoordinates(r, c, boardSize),
                        c: color,
                        p: color[0],
                        r, col: c
                    }]);
                } else if (data.pass) {
                    setMoveHistory(prev => [...prev, {
                        m: 'PASS',
                        c: color,
                        p: color[0],
                        r: -1, col: -1
                    }]);
                }

                setCaptures(prev => ({
                    ...prev,
                    [color]: prev[color] + (captured || 0)
                }));

                if (data.timers) setTimers(data.timers);
                if (data.board) {
                    setBoard(data.board);
                    boardHistoryListRef.current.push(JSON.stringify(data.board));
                }
                setLastMove({ r, c });
                if (data.board) {
                    setBoard(data.board);
                    boardHistoryListRef.current.push(JSON.stringify(data.board));
                }
                setMoveCount(prev => prev + 1);
                setCurrentPlayer(color === 'black' ? 'white' : 'black');

            } else if (data.type === 'game_over') {
                setGameState('finished');
                setWinner(data.winner_color);
                setWinReason(data.reason);
                setShowAnalysis(true);
            } else if (data.type === 'error') {
                console.error("Game error:", data.message);
                alert("Error: " + data.message);
            }
        };

        return () => ws.close();
    }, [match_id, router, boardSize]);

    useEffect(() => {
        if (gameState !== 'playing' || winner) return;
        const interval = setInterval(() => {
            setTimers(prev => ({ ...prev, [currentPlayer]: Math.max(0, prev[currentPlayer] - 1) }));
        }, 1000);
        return () => clearInterval(interval);
    }, [gameState, currentPlayer, winner]);

    const formatTime = (seconds) => {
        if (!seconds) return "0:00";
        const m = Math.floor(seconds / 60);
        const s = Math.floor(seconds % 60);
        return `${m}:${s.toString().padStart(2, '0')}`;
    };

    const handleCellClick = (r, c) => {
        if (gameState !== 'playing' || winner || currentPlayer !== myColor) return;
        if (board[r][c] !== null) return;
        socket.send(JSON.stringify({ type: 'move', r, c }));
    };

    const handlePass = () => {
        if (gameState !== 'playing' || winner || currentPlayer !== myColor) return;
        socket.send(JSON.stringify({ type: 'pass' }));
    };

    const handleResign = () => {
        if (gameState !== 'playing' || winner) return;
        socket.send(JSON.stringify({ type: 'resign' }));
    };

    useEffect(() => {
        if (gameState === 'finished' && reviewMistakes.length === 0 && !isAnalyzingMistakes && moveHistory.length > 0) {
            handleReviewMistakes();
        }
    }, [gameState]);

    const handleReviewMistakes = async () => {
        if (moveHistory.length < 5) return console.warn("Game is too short to analyze.");
        setIsAnalyzingMistakes(true);
        setShowAnalysis(true);
        const moves_history = [];
        for (let i = 0; i <= moveHistory.length; i++) {
            const tempBoardStr = boardHistoryListRef.current[i];
            if (!tempBoardStr) continue;
            const parsedBoard = JSON.parse(tempBoardStr);
            const black_stones = [];
            const white_stones = [];
            for (let r = 0; r < boardSize; r++) {
                for (let c = 0; c < boardSize; c++) {
                    if (parsedBoard[r][c] === 'black') black_stones.push(toCoordinates(r, c, boardSize));
                    if (parsedBoard[r][c] === 'white') white_stones.push(toCoordinates(r, c, boardSize));
                }
            }
            moves_history.push({
                ruleset: "japanese", komi: 6.5,
                board_size: boardSize, black_stones, white_stones,
                to_play: i % 2 === 0 ? "B" : "W",
                last_move: i > 0 && moveHistory[i - 1]?.r !== -1 ? toCoordinates(moveHistory[i - 1].r, moveHistory[i - 1].c, boardSize) : null
            });
        }

        try {
            const res = await fetch(`${API_BASE_URL}/v1/games/review`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ moves_history })
            });
            const data = await res.json();
            setIsAnalyzingMistakes(false);
            if (data.status === 'success') {
                const userMistakes = (data.mistakes || []).filter(m => m.player === (myColor === 'black' ? 'B' : 'W'));
                if (userMistakes.length > 0) {
                    setReviewMistakes(userMistakes);
                    setCurrentMistakeIndex(0);
                } else {
                    console.log("KataGo found no critical mistakes for you.");
                }
            }
        } catch (e) {
            setIsAnalyzingMistakes(false);
            console.error("Failed to analyze mistakes.", e);
        }
    };

    const handleTrainerUndo = () => {
        const m = reviewMistakes[currentMistakeIndex];
        if (!m) return;
        const newBoard = createEmptyBoard(boardSize);
        (m.state_before.black_stones || []).forEach(c => {
            const parsed = parseKataGoMove(c, boardSize);
            if (parsed) newBoard[parsed.r][parsed.c] = 'black';
        });
        (m.state_before.white_stones || []).forEach(c => {
            const parsed = parseKataGoMove(c, boardSize);
            if (parsed) newBoard[parsed.r][parsed.c] = 'white';
        });
        setMistakeTrainerBoard(newBoard);
        setTrainerFeedback(null);
        setShowTrainerOptions(false);
    };

    const handleGenerateTsumego = async () => {
        const m = reviewMistakes[currentMistakeIndex];
        if (!m) return;
        setIsGeneratingTsumego(true);
        setTrainerFeedback({ type: 'info', text: '🧠 GPT-4o is designing a new puzzle conceptually tied to this mistake...' });
        try {
            const res = await fetch(`${API_BASE_URL}/v1/ai/generate_scenario`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    state_before: m.state_before,
                    played_move: m.played_move,
                    optimal_moves: m.optimal_moves
                })
            });
            const data = await res.json();
            setIsGeneratingTsumego(false);
            if (data.status === 'success') {
                const scenario = data.scenario;
                const updatedMistakes = [...reviewMistakes];
                updatedMistakes[currentMistakeIndex] = {
                    ...m,
                    state_before: scenario.state_before,
                    optimal_moves: scenario.optimal_moves,
                    is_ai_generated: true,
                    concept_explanation: scenario.concept_explanation
                };
                const newBoard = createEmptyBoard(boardSize);
                (scenario.state_before.black_stones || []).forEach(c => {
                    const parsed = parseKataGoMove(c, boardSize);
                    if (parsed) newBoard[parsed.r][parsed.c] = 'black';
                });
                (scenario.state_before.white_stones || []).forEach(c => {
                    const parsed = parseKataGoMove(c, boardSize);
                    if (parsed) newBoard[parsed.r][parsed.c] = 'white';
                });
                setMistakeTrainerBoard(newBoard);
                setReviewMistakes(updatedMistakes);
                setTrainerAttemptCount(0);
                setTrainerFeedback(null);
            } else {
                setTrainerFeedback({ type: 'error', text: 'Failed to generate Tsumego.' });
            }
        } catch (e) {
            setIsGeneratingTsumego(false);
            setTrainerFeedback({ type: 'error', text: 'Network error generating Tsumego.' });
        }
    };

    // Automatically trigger analysis on game over
    useEffect(() => {
        if (gameState === 'finished' && reviewMistakes.length === 0 && !isAnalyzingMistakes) {
            // Already handled by the other useEffect above, this block is duplicated and safe to remove, or just kept for safety
            // I'll leave the earlier useEffect which has the proper dependency array (moveHistory > 0).
        }
    }, [gameState, reviewMistakes.length, isAnalyzingMistakes]);

    return (
        <div className="w-full bg-neutral-950 text-white min-h-[calc(100vh-4rem)] flex flex-col pt-16 sm:pt-20 overflow-hidden relative">
            <Head><title>Match {match_id} - KAI</title></Head>

            <style dangerouslySetInnerHTML={{
                __html: `
                body.theater-running header {
                    background: rgba(10, 10, 10, 0.65) !important;
                    backdrop-filter: blur(16px) saturate(180%) !important;
                    border-bottom: 1px solid rgba(255, 255, 255, 0.05) !important;
                    color: white !important;
                    box-shadow: 0 4px 30px rgba(0, 0, 0, 0.5);
                }
                body.theater-running header a, body.theater-running header span {
                    color: rgba(255,255,255,0.8) !important;
                }
                body.theater-running header a:hover {
                    color: white !important;
                }
                .theater-glass-panel {
                    background: rgba(20, 20, 22, 0.65);
                    backdrop-filter: blur(24px) saturate(150%);
                    border: 1px solid rgba(255, 255, 255, 0.06);
                    box-shadow: 0 24px 40px -8px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.05);
                }
                .active-pulse-black {
                    box-shadow: 0 0 20px rgba(255,255,255,0.1), inset 0 0 0 1px rgba(255,255,255,0.2);
                    animation: subtle-pulse-black 2s infinite ease-in-out;
                }
                .active-pulse-white {
                    box-shadow: 0 0 20px rgba(255,255,255,0.15), inset 0 0 0 1px rgba(255,255,255,0.4);
                    animation: subtle-pulse-white 2s infinite ease-in-out;
                }
                @keyframes subtle-pulse-black {
                    0% { box-shadow: 0 0 15px rgba(255,255,255,0.05), inset 0 0 0 1px rgba(255,255,255,0.1); }
                    50% { box-shadow: 0 0 25px rgba(255,255,255,0.15), inset 0 0 0 1px rgba(255,255,255,0.3); }
                    100% { box-shadow: 0 0 15px rgba(255,255,255,0.05), inset 0 0 0 1px rgba(255,255,255,0.1); }
                }
                @keyframes subtle-pulse-white {
                    0% { box-shadow: 0 0 15px rgba(255,255,255,0.1), inset 0 0 0 1px rgba(255,255,255,0.2); }
                    50% { box-shadow: 0 0 25px rgba(255,255,255,0.25), inset 0 0 0 1px rgba(255,255,255,0.5); }
                    100% { box-shadow: 0 0 15px rgba(255,255,255,0.1), inset 0 0 0 1px rgba(255,255,255,0.2); }
                }
            `}} />

            {/* AMBIENT DIMMING OVERLAY */}
            <div className={`fixed inset-0 pointer-events-none transition-colors duration-[3000ms] ${gameState === 'playing' ? 'bg-neutral-950/80 z-0' : 'bg-transparent z-0'}`} />

            <div className="flex-1 w-full max-w-[1920px] mx-auto px-4 md:px-8 py-6 relative">
                <div className="flex flex-col xl:flex-row gap-8 items-center xl:items-start justify-center min-h-[calc(100vh-8rem)]">

                    {/* LEFT PANEL */}
                    <div className="w-full xl:w-[260px] flex flex-col gap-4 shrink-0 mt-0 xl:mt-8 relative z-20">
                        {/* WHITE PLAYER CARD */}
                        <div className={`theater-glass-panel rounded-[24px] p-5 flex flex-col transition-all duration-500 ${currentPlayer === 'white' && gameState === 'playing' ? 'active-pulse-white scale-[1.02]' : 'opacity-80'}`}>
                            <div className="flex items-center gap-4 mb-4">
                                <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-gray-100 to-white shadow-inner flex items-center justify-center border-2 border-transparent">
                                    <Cpu className="w-6 h-6 text-gray-800" />
                                </div>
                                <div className="flex flex-col">
                                    <span className="font-bold text-[16px] text-white tracking-wide">{whitePlayer}</span>
                                    <span className="text-[12px] text-gray-400">White</span>
                                </div>
                            </div>
                            <div className="flex justify-between items-end">
                                <div className="flex flex-col">
                                    <span className="text-[10px] uppercase tracking-widest text-gray-500 font-bold mb-1">Captures</span>
                                    <div className="flex items-center gap-1.5">
                                        <div className="w-3 h-3 rounded-full bg-white/20" />
                                        <span className="text-[14px] font-bold text-gray-300">{captures.white}</span>
                                    </div>
                                </div>
                                <div className={`font-mono text-3xl font-black tracking-tighter ${currentPlayer === 'white' && gameState === 'playing' ? 'text-white' : 'text-gray-500'}`}>
                                    {formatTime(timers.white)}
                                </div>
                            </div>
                        </div>

                        {/* BLACK PLAYER CARD */}
                        <div className={`theater-glass-panel rounded-[24px] p-5 flex flex-col transition-all duration-500 ${currentPlayer === 'black' && gameState === 'playing' ? 'active-pulse-black scale-[1.02]' : 'opacity-80'}`}>
                            <div className="flex items-center gap-4 mb-4">
                                <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-gray-800 to-gray-900 shadow-[inset_0_2px_4px_rgba(255,255,255,0.1)] flex items-center justify-center border-2 border-transparent">
                                    <Users className="w-6 h-6 text-white" />
                                </div>
                                <div className="flex flex-col">
                                    <span className="font-bold text-[16px] text-white tracking-wide">{blackPlayer}</span>
                                    <span className="text-[12px] text-gray-400">Black</span>
                                </div>
                            </div>
                            <div className="flex justify-between items-end">
                                <div className="flex flex-col">
                                    <span className="text-[10px] uppercase tracking-widest text-gray-500 font-bold mb-1">Captures</span>
                                    <div className="flex items-center gap-1.5">
                                        <div className="w-3 h-3 rounded-full bg-white/20" />
                                        <span className="text-[14px] font-bold text-gray-300">{captures.black}</span>
                                    </div>
                                </div>
                                <div className={`font-mono text-3xl font-black tracking-tighter ${currentPlayer === 'black' && gameState === 'playing' ? 'text-white' : 'text-gray-500'}`}>
                                    {formatTime(timers.black)}
                                </div>
                            </div>
                        </div>

                        {/* MATCH CONTROLS */}
                        <div className="theater-glass-panel rounded-[32px] mt-4 h-[92px] p-2 flex items-center justify-center gap-2 w-full">
                            <button onClick={handlePass} disabled={gameState !== 'playing' || currentPlayer !== myColor} className="flex-1 h-full rounded-[24px] flex flex-col items-center justify-center gap-1.5 transition-all text-gray-400 hover:text-white hover:bg-white/5 disabled:opacity-30">
                                <div className="w-8 h-8 rounded-full bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20"><Play className="w-3.5 h-3.5 text-emerald-400" /></div>
                                <span className="text-[10px] uppercase tracking-wider font-bold">Pass</span>
                            </button>
                            <div className="w-[1px] h-12 bg-white/10" />
                            <button onClick={handleResign} disabled={gameState !== 'playing'} className="flex-1 h-full rounded-[24px] flex flex-col items-center justify-center gap-1.5 transition-all text-gray-400 hover:text-white hover:bg-white/5 disabled:opacity-30">
                                <div className="w-8 h-8 rounded-full bg-red-500/10 flex items-center justify-center border border-red-500/20"><Flag className="w-3.5 h-3.5 text-red-400" /></div>
                                <span className="text-[10px] uppercase tracking-wider font-bold">Resign</span>
                            </button>
                        </div>
                    </div>

                    {/* BOARD */}
                    <div className="flex flex-col items-center shrink-0 w-full xl:w-auto z-10 transition-transform duration-700" style={{ transform: `scale(${showAnalysis ? 0.95 : 1})` }}>
                        <div className="relative inline-flex items-center justify-center group mb-8">

                            {/* THEATER MODE BOWLS (Right Flank) */}
                            <div className={`absolute top-[52%] z-[5] hidden xl:flex flex-col pointer-events-none transition-all duration-[800ms] ease-[cubic-bezier(0.4,0,0.2,1)] origin-right ${showAnalysis ? 'gap-[120px]' : 'gap-[20px]'}`}
                                style={{
                                    left: `calc(50% + ${boardPx / 2}px + ${showAnalysis ? '5' : '60'}px)`,
                                    transform: `translateY(-50%) scale(${showAnalysis ? 0.33 : 1})`
                                }}>
                                {/* White Bowl */}
                                <div className="relative w-[360px] h-[360px]">
                                    <img src="/assets/bowls_v3/white.png" className="absolute inset-0 w-full h-full object-contain z-10 drop-shadow-[0_45px_45px_rgba(0,0,0,0.7)]" alt="White Stones" />
                                </div>
                                {/* Black Bowl */}
                                <div className="relative w-[360px] h-[360px]">
                                    <img src="/assets/bowls_v3/black.png" className="absolute inset-0 w-full h-full object-contain z-10 drop-shadow-[0_45px_45px_rgba(0,0,0,0.7)]" alt="Black Stones" />
                                </div>
                            </div>

                            {/* Physical Board Component */}
                            <div className="relative inline-block transition-all duration-1000">
                                <GoBoard
                                    boardSize={boardSize}
                                    boardPx={boardPx}
                                    displayBoard={board}
                                    onIntersectionClick={handleCellClick}
                                    hoverColor={gameState === 'playing' && currentPlayer === myColor ? myColor : null}
                                    lastMoveCoords={lastMove}
                                />
                                {gameState === 'connecting' && (
                                    <div className="absolute inset-0 bg-black/50 backdrop-blur-sm z-50 flex flex-col items-center justify-center text-white rounded-[6px]">
                                        <div className="w-12 h-12 border-4 border-[#4CAF84] border-t-transparent rounded-full animate-spin mb-4" />
                                        <h2 className="text-2xl font-bold tracking-widest">CONNECTING TO LOBBY</h2>
                                    </div>
                                )}
                                {gameState === 'finished' && (
                                    <div className="absolute inset-0 bg-black/60 backdrop-blur-md z-50 flex flex-col items-center justify-center text-white rounded-[6px]">
                                        <h2 className="text-4xl font-black text-[#E9C46A] tracking-widest drop-shadow-2xl mb-2">{winner ? `${winner.toUpperCase()} VICTORIOUS` : 'DRAW'}</h2>
                                        <div className="text-lg font-bold text-gray-300 uppercase tracking-widest">{winReason}</div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {showAnalysis ? (
                        <div className={`z-30 pt-[10px] hidden xl:flex flex-col shrink-0 transition-all duration-[800ms] ease-[cubic-bezier(0.4,0,0.2,1)] overflow-visible order-3 w-[420px] opacity-100`}>
                            <div className="w-full xl:w-[420px] bg-[#FFFFFF] rounded-[16px] shadow-[0_20px_50px_rgba(0,0,0,0.3)] p-[16px] flex flex-col shrink-0 h-[600px] xl:max-h-[calc(100vh-140px)] pt-4 relative">
                                <button
                                    onClick={() => setShowAnalysis(false)}
                                    className="absolute -left-3 -top-3 bg-white hover:bg-red-50 text-gray-400 hover:text-red-500 rounded-[10px] p-2 shadow-md border border-gray-100 z-50 transition-colors"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                                <div className="flex flex-col h-full overflow-y-auto custom-scrollbar pr-1 gap-4">
                                    <div className="text-[13px] uppercase font-bold text-gray-500 tracking-widest flex items-center gap-2 border-b border-gray-100 pb-3">
                                        <Activity className="w-4 h-4 text-blue-500" /> Match Review
                                    </div>

                                    {isAnalyzingMistakes ? (
                                        <div className="flex-1 flex flex-col items-center justify-center text-indigo-500 animate-pulse">
                                            <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-500 rounded-full animate-spin mb-4" />
                                            <div className="text-[12px] font-bold tracking-widest uppercase">Connecting to KataGo...</div>
                                        </div>
                                    ) : reviewMistakes.length > 0 ? (
                                        <>
                                            {reviewMistakes[currentMistakeIndex] && (
                                                <div className="flex flex-col gap-4">
                                                    <div className="bg-red-50 border border-red-100 rounded-[12px] p-4">
                                                        <div className="text-[13px] font-bold text-red-600 mb-1">
                                                            Turn {reviewMistakes[currentMistakeIndex].turn} • {reviewMistakes[currentMistakeIndex].type === 'blunder' ? 'Critical Blunder' : 'Mistake'}
                                                        </div>
                                                        <div className="text-[14px] text-gray-800 font-medium">
                                                            You played <span className="font-bold">{reviewMistakes[currentMistakeIndex].played_move}</span> and lost <span className="font-bold text-red-500">{(reviewMistakes[currentMistakeIndex].winrate_drop * 100).toFixed(1)}%</span> winrate.
                                                        </div>
                                                        <div className="text-[12px] text-gray-500 mt-2">
                                                            {reviewMistakes[currentMistakeIndex].is_ai_generated
                                                                ? reviewMistakes[currentMistakeIndex].concept_explanation
                                                                : "KataGo identified this as a critical turning point. Can you spot the correct sequence?"}
                                                        </div>
                                                    </div>

                                                    <div className="bg-blue-50/70 border border-blue-200 rounded-[12px] p-4 text-[13px] shadow-sm relative overflow-hidden mt-2">
                                                        <div className="absolute top-0 left-0 w-1 h-full bg-blue-400" />
                                                        <div className="font-bold text-blue-800 mb-3 flex items-center gap-2 tracking-wide uppercase text-[11px]">
                                                            <Cpu className="w-3.5 h-3.5" /> KataGo Top Options
                                                        </div>
                                                        <div className="flex flex-col gap-2 font-mono text-blue-800">
                                                            {(() => {
                                                                const m = reviewMistakes[currentMistakeIndex];
                                                                const sorted = [...(m.optimal_moves || [])].sort((a: any, b: any) => (b.scoreLead || 0) - (a.scoreLead || 0));
                                                                return sorted.slice(0, 5).map((opt: any, i: number) => (
                                                                    <div key={i} className="flex justify-between items-center bg-white border border-blue-100 px-3 py-2 rounded-[8px] shadow-sm">
                                                                        <div className="flex items-center gap-2">
                                                                            <span className={`font-black px-1.5 py-0.5 rounded text-[11px] ${i === 0 ? 'bg-blue-500 text-white shadow-sm' : 'bg-blue-50 text-blue-600'}`}>
                                                                                {i === 0 ? 'BEST MOVE' : `#${i + 1}`}
                                                                            </span>
                                                                            <span className="font-bold text-[14px] w-8">{opt.move}</span>
                                                                        </div>
                                                                        <div className="text-[12px]">
                                                                            <span className="text-gray-400 font-medium">Score:</span> <span className="font-bold text-blue-700">{opt.scoreLead > 0 ? '+' : ''}{opt.scoreLead ? opt.scoreLead.toFixed(1) : 0} pts</span>
                                                                        </div>
                                                                    </div>
                                                                ));
                                                            })()}
                                                        </div>
                                                    </div>

                                                    <div className="mt-auto flex gap-3 pt-6">
                                                        <button onClick={() => {
                                                            if (currentMistakeIndex > 0) setCurrentMistakeIndex(p => p - 1);
                                                        }} disabled={currentMistakeIndex === 0} className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-[10px] transition-colors shadow-sm disabled:opacity-50">
                                                            &lt; Prev
                                                        </button>

                                                        {currentMistakeIndex < reviewMistakes.length - 1 ? (
                                                            <button onClick={() => {
                                                                setCurrentMistakeIndex(p => p + 1);
                                                            }} className={`flex-[2] py-3 text-white font-bold rounded-[10px] transition-colors shadow-sm bg-blue-500 hover:bg-blue-600`}>
                                                                Next Mistake &gt;
                                                            </button>
                                                        ) : (
                                                            <button onClick={() => {
                                                                setShowAnalysis(false);
                                                            }} className={`flex-[2] py-3 text-white font-bold rounded-[10px] transition-colors shadow-sm bg-gray-900 hover:bg-black`}>
                                                                Finish Review
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            )}
                                        </>
                                    ) : (
                                        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center gap-3 opacity-80">
                                            <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[#E9C46A] drop-shadow-md mb-2"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" /><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" /><path d="M4 22h16" /><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" /><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" /><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" /></svg>
                                            <div className="text-[#4DAA7F] font-bold tracking-[0.2em] text-[16px] uppercase relative">
                                                Flawless Play
                                            </div>
                                            <div className="text-gray-500 text-[13px] font-medium leading-relaxed">
                                                KataGo found absolutely no critical mistakes or blunders in your play this game.
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    ) : null}
                </div>
            </div >
        </div >
    );
}
