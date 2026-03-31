import React, { useState, useEffect, useRef } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { motion, AnimatePresence } from 'framer-motion';
import { Settings, Flag, User, Cpu, ChevronLeft, Activity, MessageSquare, ListTree } from 'lucide-react';

const xLabels = "ABCDEFGHJKLMNOPQRST";
const toCoordinates = (r, c, boardSize) => {
    const x = xLabels[c];
    const y = boardSize - r;
    return `${x}${y}`;
};

const createEmptyBoard = (size) => Array(size).fill(null).map(() => Array(size).fill(null));

export default function WatchMatch() {
    const router = useRouter();
    const { match_id } = router.query;

    const [gameState, setGameState] = useState('connecting'); // connecting, playing, finished
    const [boardSize, setBoardSize] = useState(19);

    // --- GAME STATE --- //
    const [board, setBoard] = useState(createEmptyBoard(19));
    const [myColor, setMyColor] = useState(null); // 'black' or 'white'
    const [blackPlayer, setBlackPlayer] = useState(null);
    const [whitePlayer, setWhitePlayer] = useState(null);
    const [currentPlayer, setCurrentPlayer] = useState('black');
    const [moveCount, setMoveCount] = useState(0);
    const [winner, setWinner] = useState(null);
    const [winReason, setWinReason] = useState(null);

    const [captures, setCaptures] = useState({ black: 0, white: 0 });
    const [timers, setTimers] = useState({ black: 0, white: 0 });
    const [lastMove, setLastMove] = useState(null); // {r, c}

    // --- UI OPTIONS STATE --- //
    const [activeTab, setActiveTab] = useState('chat'); // 'chat' | 'analysis' | 'tree'
    const [socket, setSocket] = useState(null);
    const [boardPx, setBoardPx] = useState(640);

    // --- WEBSOCKET CONNECTION --- //
    useEffect(() => {
        if (!match_id) return;
        const token = localStorage.getItem('token');
        if (!token || token === 'undefined' || token === 'null') return;

        const ws = new WebSocket(`ws://89.167.122.76:8800/v1/ws/matches/${match_id}?token=${token}`);
        setSocket(ws);

        ws.onopen = () => {
            console.log("Connected to match room");
            setGameState('playing');
        };

        ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            if (data.type === 'game_start') {
                setGameState('playing');
                const newSize = data.board_size || 19;
                setBoardSize(newSize);
                setBoard(createEmptyBoard(newSize));
                setBlackPlayer(data.black_player);
                setWhitePlayer(data.white_player);

                // Determine our color directly from the server payload
                if (data.your_color && data.your_color !== 'spectator') {
                    setMyColor(data.your_color);
                } else {
                    setMyColor('black'); // Spectator POV
                }

                if (data.board) setBoard(data.board);
                if (data.captures) setCaptures(data.captures);
                if (data.current_player) setCurrentPlayer(data.current_player);

                if (data.timers) {
                    setTimers(data.timers);
                } else {
                    setTimers({ black: 900, white: 900 });
                }
            } else if (data.type === 'game_state') {
                // Future expansion: sync full state
            } else if (data.type === 'move') {
                // Apply move to local board state
                const { r, c, color, captured } = data;

                // Ensure we know current player turns

                setBoard(prevBoard => {
                    const newBoard = prevBoard.map(row => [...row]);
                    newBoard[r][c] = color;
                    // The server handles captures, but for MVP we might need to locally recalculate them or the server should send the updated board.
                    // For the sake of simplicity, let's call our local applyGoRules just to clean the visual board.
                    const result = applyGoRules(prevBoard, color, r, c);
                    if (result) return result.newBoard;
                    return newBoard;
                });

                setCaptures(prev => ({
                    ...prev,
                    [color]: prev[color] + (captured || 0)
                }));

                if (data.timers) {
                    setTimers(data.timers);
                }

                setLastMove({ r, c });
                setMoveCount(prev => prev + 1);
                setCurrentPlayer(color === 'black' ? 'white' : 'black');

            } else if (data.type === 'error') {
                console.error("Game error:", data.message);
            } else if (data.type === 'game_over') {
                setGameState('finished');
                setWinner(data.winner_color);
                setWinReason(data.reason);
            }
        };

        ws.onclose = () => {
            console.log("Disconnected from match");
        };

        return () => {
            if (ws) ws.close();
        };
    }, [match_id, router]);

    // Local Timer Countdown
    useEffect(() => {
        if (gameState !== 'playing' || winner) return;

        const interval = setInterval(() => {
            setTimers(prev => {
                const currentVal = prev[currentPlayer];
                if (currentVal <= 0) return prev;
                return {
                    ...prev,
                    [currentPlayer]: currentVal - 1
                };
            });
        }, 1000);

        return () => clearInterval(interval);
    }, [gameState, currentPlayer, winner]);

    const formatTime = (seconds) => {
        if (seconds === undefined || seconds === null) return "0:00";
        const m = Math.floor(seconds / 60);
        const s = Math.floor(seconds % 60);
        return `${m}:${s.toString().padStart(2, '0')}`;
    };

    useEffect(() => {
        const updateSize = () => {
            const availableHeight = window.innerHeight - 280;
            const availableWidth = window.innerWidth - 600;
            const size = Math.max(400, Math.min(availableHeight, availableWidth, 800));
            setBoardPx(size);
        };
        updateSize();
        window.addEventListener('resize', updateSize);
        return () => window.removeEventListener('resize', updateSize);
    }, []);

    const safeBoardPx = boardPx * 0.94;
    const cellPx = safeBoardPx / boardSize;
    const paddingPx = (boardPx - (cellPx * (boardSize - 1))) / 2;

    // --- GAME RULES ENGINE (Local for optimistic rendering/cleanup) --- //
    const getNeighbors = (r, c) => {
        const neighbors = [];
        if (r > 0) neighbors.push([r - 1, c]);
        if (r < boardSize - 1) neighbors.push([r + 1, c]);
        if (c > 0) neighbors.push([r, c - 1]);
        if (c < boardSize - 1) neighbors.push([r, c + 1]);
        return neighbors;
    };

    const getChainAndLiberties = (currentBoard, startR, startC) => {
        const color = currentBoard[startR][startC];
        const chain = [];
        const liberties = new Set();
        const visited = new Set();
        const stack = [[startR, startC]];

        while (stack.length > 0) {
            const [r, c] = stack.pop();
            const key = `${r},${c}`;

            if (visited.has(key)) continue;
            visited.add(key);
            chain.push([r, c]);

            for (const [nr, nc] of getNeighbors(r, c)) {
                if (currentBoard[nr][nc] === null) {
                    liberties.add(`${nr},${nc}`);
                } else if (currentBoard[nr][nc] === color && !visited.has(`${nr},${nc}`)) {
                    stack.push([nr, nc]);
                }
            }
        }
        return { chain, liberties: liberties.size };
    };

    const applyGoRules = (currentBoard, playerColor, moveR, moveC) => {
        const newBoard = currentBoard.map(row => [...row]);
        newBoard[moveR][moveC] = playerColor;
        const opponentColor = playerColor === 'black' ? 'white' : 'black';

        let capturedStones = 0;

        for (const [nr, nc] of getNeighbors(moveR, moveC)) {
            if (newBoard[nr][nc] === opponentColor) {
                const { chain, liberties } = getChainAndLiberties(newBoard, nr, nc);
                if (liberties === 0) {
                    for (const [cr, cc] of chain) {
                        newBoard[cr][cc] = null;
                        capturedStones++;
                    }
                }
            }
        }

        if (capturedStones === 0) {
            const { liberties } = getChainAndLiberties(newBoard, moveR, moveC);
            if (liberties === 0) {
                return null;
            }
        }

        return { newBoard, capturedStones };
    };

    const handleIntersectionClick = (row, col) => {
        // Observers cannot play moves
        return;
    };

    const handleResign = () => {
        // Observers cannot resign
        return;
    };

    const getHoshiPoints = () => {
        if (boardSize === 19) return [[3, 3], [3, 9], [3, 15], [9, 3], [9, 9], [9, 15], [15, 3], [15, 9], [15, 15]];
        if (boardSize === 13) return [[3, 3], [3, 9], [6, 6], [9, 3], [9, 9]];
        if (boardSize === 9) return [[2, 2], [2, 6], [4, 4], [6, 2], [6, 6]];
        return [];
    };

    if (gameState === 'connecting') {
        return (
            <div className="min-h-screen bg-[#F4F4F2] flex items-center justify-center flex-col gap-4">
                <div className="w-12 h-12 border-4 border-[#4CAF84]/20 border-t-[#4CAF84] rounded-full animate-spin"></div>
                <div className="font-semibold text-gray-500">Connecting to game server...</div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#F4F4F2] text-gray-900 font-sans flex justify-center pt-24 pb-6 px-4">
            <Head>
                <title>Match {match_id} | Online-Go</title>
            </Head>

            <div className="w-full max-w-[1400px] flex flex-col items-center">
                <div className="w-full h-[64px] flex items-center justify-between shrink-0 mb-6 px-4 border-b border-[#EAEAEA] bg-transparent">
                    <div className="flex items-center gap-4">
                        <Link href="/play" className="text-gray-400 hover:text-gray-900 transition-colors">
                            <ChevronLeft className="w-5 h-5" />
                        </Link>
                        <div className="flex items-baseline gap-3">
                            <span className="text-[15px] font-semibold text-gray-900">Live Match</span>
                            <span className="text-[13px] text-gray-500 font-medium">{boardSize}x{boardSize} • Japanese rules</span>
                        </div>
                    </div>
                </div>

                <main className="w-full flex flex-col xl:flex-row gap-[24px] justify-center items-start">

                    {/* LEFT PANEL */}
                    <div className="w-full xl:w-[200px] flex xl:flex-col gap-[24px] shrink-0 order-2 xl:order-1 pt-4">
                        {/* Opponent Card */}
                        <div className="flex-1 xl:flex-none bg-[#FFFFFF] rounded-[16px] p-[16px] shadow-[0_10px_25px_rgba(0,0,0,0.05)] flex flex-col items-center relative">
                            <div className="w-[72px] h-[72px] rounded-full bg-gray-100 flex items-center justify-center mb-3">
                                {myColor === 'white' ? (
                                    <div className="w-10 h-10 rounded-full bg-black shadow-[inset_2px_4px_4px_rgba(255,255,255,0.2)]"></div>
                                ) : (
                                    <div className="w-10 h-10 rounded-full bg-white shadow-[inset_2px_4px_4px_rgba(0,0,0,0.15)]"></div>
                                )}
                            </div>
                            <div className="font-bold text-gray-900 text-[15px] truncate max-w-[150px]">
                                {myColor === 'white' ? blackPlayer?.username || 'Black' : whitePlayer?.username || 'White'}
                            </div>
                            <div className="mb-3 mt-2">
                                <span className={`font-mono text-xl font-bold px-4 py-1.5 rounded-lg shadow-inner ${((myColor === 'white' && currentPlayer === 'black') || (myColor === 'black' && currentPlayer === 'white')) ? 'bg-[#E5F1EB] text-[#4CAF84]' : 'bg-gray-100 text-gray-800'}`}>
                                    {timers ? (myColor === 'white' ? formatTime(timers.black) : formatTime(timers.white)) : "0:00"}
                                </span>
                            </div>

                            <div className="w-full border-t border-[#F0F0F0] pt-4 mb-3 flex justify-between items-center px-1">
                                <span className="text-[10px] uppercase font-bold text-gray-400 tracking-widest">Captures</span>
                                <span className="text-[15px] font-bold text-gray-900">{myColor === 'white' ? captures.black : captures.white}</span>
                            </div>
                            <div className="mt-2 h-[24px]">
                                {myColor === 'white' && currentPlayer === 'black' && (
                                    <div className="bg-[#E5F1EB] text-[#4CAF84] text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full">
                                        Thinking
                                    </div>
                                )}
                                {myColor === 'black' && currentPlayer === 'white' && (
                                    <div className="bg-[#E5F1EB] text-[#4CAF84] text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full">
                                        Thinking
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Player Card */}
                        <div className="flex-1 xl:flex-none bg-[#FFFFFF] rounded-[16px] p-[16px] shadow-[0_10px_25px_rgba(0,0,0,0.05)] flex flex-col items-center relative">
                            <div className="w-[72px] h-[72px] rounded-full bg-gray-100 flex items-center justify-center mb-3">
                                {myColor === 'black' ? (
                                    <div className="w-10 h-10 rounded-full bg-black shadow-[inset_2px_4px_4px_rgba(255,255,255,0.2)]"></div>
                                ) : (
                                    <div className="w-10 h-10 rounded-full bg-white shadow-[inset_2px_4px_4px_rgba(0,0,0,0.15)]"></div>
                                )}
                            </div>
                            <div className="font-bold text-gray-900 text-[15px] truncate max-w-[150px]">
                                {myColor === 'black' ? blackPlayer?.username || 'Black' : whitePlayer?.username || 'White'}
                            </div>
                            <div className="mb-3 mt-2">
                                <span className={`font-mono text-xl font-bold px-4 py-1.5 rounded-lg shadow-inner ${currentPlayer === myColor ? 'bg-[#E5F1EB] text-[#4CAF84]' : 'bg-gray-100 text-gray-800'}`}>
                                    {timers ? (myColor === 'black' ? formatTime(timers.black) : formatTime(timers.white)) : "0:00"}
                                </span>
                            </div>

                            <div className="w-full border-t border-[#F0F0F0] pt-4 mb-3 flex justify-between items-center px-1">
                                <span className="text-[10px] uppercase font-bold text-gray-400 tracking-widest">Captures</span>
                                <span className="text-[15px] font-bold text-gray-900">{myColor === 'black' ? captures.black : captures.white}</span>
                            </div>
                            <div className="mt-2 h-[24px]">
                                {currentPlayer === myColor && (
                                    <div className="bg-[#E5F1EB] text-[#4CAF84] text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full">
                                        Your Turn
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* CENTER BOARD */}
                    <div className="flex flex-col items-center shrink-0 order-1 xl:order-2 gap-[24px] z-10 w-full xl:w-auto overflow-hidden">
                        <div className="relative inline-flex items-center justify-center">
                            <div className="absolute inset-0 pointer-events-none z-0">
                                <div className="absolute -top-7 left-0 right-0 flex justify-between" style={{ paddingLeft: paddingPx, paddingRight: paddingPx }}>
                                    {Array.from({ length: boardSize }).map((_, i) => (
                                        <div key={`t${i}`} className="text-[11px] font-semibold text-gray-500 w-full text-center">{xLabels[i]}</div>
                                    ))}
                                </div>
                                <div className="absolute -bottom-7 left-0 right-0 flex justify-between" style={{ paddingLeft: paddingPx, paddingRight: paddingPx }}>
                                    {Array.from({ length: boardSize }).map((_, i) => (
                                        <div key={`b${i}`} className="text-[11px] font-semibold text-gray-500 w-full text-center">{xLabels[i]}</div>
                                    ))}
                                </div>
                            </div>

                            <div
                                className="relative rounded-[8px] z-10"
                                style={{
                                    backgroundColor: '#D9A85B',
                                    backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)' opacity='0.08'/%3E%3C/svg%3E"), linear-gradient(135deg, rgba(255,255,255,0.2) 0%, rgba(0,0,0,0) 40%, rgba(0,0,0,0.15) 100%)`,
                                    padding: `${paddingPx}px`,
                                    boxShadow: '0 20px 40px -10px rgba(0,0,0,0.15), inset 0 2px 4px rgba(255,255,255,0.3), inset 0 -4px 8px rgba(0,0,0,0.2)',
                                    width: `${boardPx}px`,
                                    height: `${boardPx}px`
                                }}
                            >
                                <div className="relative z-10" style={{ display: 'grid', gridTemplateColumns: `repeat(${boardSize - 1}, ${cellPx}px)`, gridTemplateRows: `repeat(${boardSize - 1}, ${cellPx}px)`, width: `${(boardSize - 1) * cellPx}px`, height: `${(boardSize - 1) * cellPx}px` }}>
                                    {Array.from({ length: (boardSize - 1) * (boardSize - 1) }).map((_, i) => (
                                        <div key={i} className="border-t border-l border-black/60" />
                                    ))}
                                </div>
                                <div className="absolute border-r border-b border-black/60" style={{ left: paddingPx, top: paddingPx, width: `${(boardSize - 1) * cellPx}px`, height: `${(boardSize - 1) * cellPx}px` }} />

                                {getHoshiPoints().map(([r, c], i) => (
                                    <div key={i} className="absolute bg-black/80 rounded-full -translate-x-1/2 -translate-y-1/2 z-10" style={{ left: paddingPx + c * cellPx, top: paddingPx + r * cellPx, width: boardSize === 19 ? 8 : 6, height: boardSize === 19 ? 8 : 6 }} />
                                ))}

                                <div className="absolute inset-0 w-full h-full pointer-events-none" style={{ padding: paddingPx, zIndex: 30 }}>
                                    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${boardSize}, ${cellPx}px)`, gridTemplateRows: `repeat(${boardSize}, ${cellPx}px)`, width: `${boardSize * cellPx}px`, height: `${boardSize * cellPx}px`, marginLeft: `-${cellPx / 2}px`, marginTop: `-${cellPx / 2}px` }}>
                                        {board.map((row, r) => row.map((stone, c) => (
                                            <div
                                                key={`${r}-${c}`}
                                                className="relative flex items-center justify-center cursor-pointer group pointer-events-auto"
                                                style={{ width: cellPx, height: cellPx }}
                                                onClick={() => handleIntersectionClick(r, c)}
                                            >
                                                {stone === null && gameState === 'playing' && (
                                                    <div className="w-[85%] h-[85%] bg-black/20 rounded-full opacity-0 group-hover:opacity-100 scale-75 group-hover:scale-100 transition-all duration-150 shadow-inner block" />
                                                )}

                                                <AnimatePresence>
                                                    {stone && (
                                                        <motion.div
                                                            initial={{ scale: 0, opacity: 0 }}
                                                            animate={{ scale: 1, opacity: 1 }}
                                                            exit={{ scale: 0, opacity: 0 }}
                                                            transition={{ type: "spring", stiffness: 700, damping: 25 }}
                                                            className={`absolute w-[95%] h-[95%] rounded-full flex items-center justify-center pointer-events-none ${stone === 'black' ? 'shadow-[2px_4px_6px_rgba(0,0,0,0.5),inset_2px_4px_4px_rgba(255,255,255,0.2),inset_-2px_-5px_8px_rgba(0,0,0,0.9)]' : 'shadow-[2px_4px_6px_rgba(0,0,0,0.15),inset_2px_4px_4px_rgba(255,255,255,1),inset_-2px_-5px_8px_rgba(0,0,0,0.15)]'}`}
                                                            style={{ background: stone === 'black' ? 'radial-gradient(circle at 35% 35%, #555 0%, #111 30%, #000 100%)' : 'radial-gradient(circle at 35% 35%, #fff 0%, #f0f0f0 40%, #e0e0e0 100%)' }}
                                                        >
                                                            {lastMove && lastMove.r === r && lastMove.c === c && (
                                                                <div className={`w-[25%] h-[25%] rounded-full opacity-80 ${stone === 'black' ? 'bg-white shadow' : 'bg-black/60 shadow-sm'}`} />
                                                            )}
                                                        </motion.div>
                                                    )}
                                                </AnimatePresence>
                                            </div>
                                        )))}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Panels */}
                        <div className="h-[64px] bg-[#FFFFFF] rounded-[16px] shadow-[0_10px_25px_rgba(0,0,0,0.05)] w-full flex items-center justify-between px-4 shrink-0 relative" style={{ maxWidth: boardPx }}>
                            <div className="flex gap-2">
                                <button className="h-[36px] px-6 rounded-full bg-[#E5F1EB] hover:bg-[#D5EAE0] text-[#4CAF84] font-semibold text-sm transition-colors flex items-center gap-2">
                                    <div className="w-2.5 h-2.5 bg-[#4CAF84] rounded-full"></div> Pass
                                </button>
                                <button onClick={handleResign} className="h-[36px] px-6 rounded-full bg-[#FCE8E8] hover:bg-[#fae0e0] text-[#E56A6A] font-medium text-sm transition-colors flex items-center gap-2">
                                    <Flag className="w-3.5 h-3.5" /> Resign
                                </button>
                            </div>
                            <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-4 text-gray-400">
                                <span className="text-sm font-semibold text-gray-900 mx-1 w-16 text-center">Move {moveCount}</span>
                            </div>
                        </div>
                    </div>

                    {/* RIGHT PANEL */}
                    <div className="w-full xl:w-[280px] bg-[#FFFFFF] rounded-[16px] shadow-[0_10px_25px_rgba(0,0,0,0.05)] p-[16px] flex flex-col shrink-0 order-3 h-[600px] xl:h-[auto] xl:max-h-[calc(100vh-160px)] pt-4">
                        <div className="flex border-b border-[#F0F0F0] shrink-0 mb-4 px-2">
                            <button onClick={() => setActiveTab('chat')} className={`flex-1 pb-3 text-[13px] font-medium transition-colors relative ${activeTab === 'chat' ? 'text-[#4CAF84]' : 'text-gray-400 hover:text-gray-600'}`}>
                                Chat
                                {activeTab === 'chat' && <div className="absolute -bottom-[1px] left-0 right-0 h-[2px] bg-[#4CAF84]" />}
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto hide-scrollbar">
                            {activeTab === 'chat' && (
                                <div className="flex flex-col gap-4 text-sm text-gray-500 text-center pt-10">
                                    Send good vibes to your opponent!
                                </div>
                            )}
                        </div>
                    </div>
                </main>
            </div>

            <AnimatePresence>
                {gameState === 'finished' && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm"
                    >
                        <div className="w-full max-w-[400px] bg-white rounded-[24px] p-8 shadow-2xl text-center">
                            <h1 className="text-3xl font-bold mb-2 text-gray-900">Game Over</h1>
                            <p className="text-gray-500 mb-8 font-medium">Winner: {winner?.toUpperCase()} ({winReason})</p>

                            <Link href="/play">
                                <button className="w-full py-4 bg-[#4CAF84] hover:bg-[#3d966e] text-white font-bold rounded-[12px] transition-colors">
                                    Return to Lobby
                                </button>
                            </Link>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
