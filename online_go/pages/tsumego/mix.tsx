import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { ChevronLeft, ArrowLeft, Undo2, CheckCircle2, XCircle, Info, SkipForward, RotateCcw, Lightbulb } from 'lucide-react';

interface Puzzle {
    id: string;
    source_key: string;
    board_width: number;
    board_height: number;
    to_play: 'B' | 'W';
    goal_type: string;
    difficulty_source?: string;
    tags: string[];
    collection_name?: string;
    normalized_json?: any;
    difficulty_rank?: string;
}

const getCrop = (stones: number[][], size: number) => {
    if (!stones || stones.length === 0) return { minR: 0, maxR: size - 1, minC: 0, maxC: size - 1, viewSize: size };
    let minR = size, maxR = -1;
    let minC = size, maxC = -1;
    stones.forEach(([r, c]) => {
        if (r < minR) minR = r;
        if (r > maxR) maxR = r;
        if (c < minC) minC = c;
        if (c > maxC) maxC = c;
    });

    let spanR = maxR - minR;
    let spanC = maxC - minC;
    let maxSpan = Math.max(spanR, spanC);

    let viewSize = size;
    if (size > 13 && maxSpan <= 11) viewSize = 13;
    if (size >= 9 && maxSpan <= 7) viewSize = 9;

    let viewMinR = 0, viewMinC = 0;

    if (maxR < viewSize) viewMinR = 0;
    else if (minR > size - 1 - viewSize) viewMinR = size - viewSize;
    else viewMinR = Math.max(0, minR - Math.floor((viewSize - spanR) / 2));

    if (maxC < viewSize) viewMinC = 0;
    else if (minC > size - 1 - viewSize) viewMinC = size - viewSize;
    else viewMinC = Math.max(0, minC - Math.floor((viewSize - spanC) / 2));

    return {
        minR: viewMinR,
        maxR: viewMinR + viewSize - 1,
        minC: viewMinC,
        maxC: viewMinC + viewSize - 1,
        viewSize
    };
};

const getLiberties = (board: any[][], sr: number, sc: number) => {
    const color = board[sr][sc];
    if (!color) return { liberties: -1, group: [] };

    const visited = new Set<string>();
    const group: { r: number, c: number }[] = [];
    let liberties = 0;

    const size = board.length;
    const queue = [{ r: sr, c: sc }];
    visited.add(`${sr},${sc}`);

    while (queue.length > 0) {
        const curr = queue.shift()!;
        group.push(curr);

        const neighbors = [
            { r: curr.r - 1, c: curr.c }, { r: curr.r + 1, c: curr.c },
            { r: curr.r, c: curr.c - 1 }, { r: curr.r, c: curr.c + 1 }
        ];

        for (const n of neighbors) {
            if (n.r >= 0 && n.r < size && n.c >= 0 && n.c < size) {
                const key = `${n.r},${n.c}`;
                if (board[n.r][n.c] === null) {
                    if (!visited.has(key)) {
                        visited.add(key);
                        liberties++;
                    }
                } else if (board[n.r][n.c] === color) {
                    if (!visited.has(key)) {
                        visited.add(key);
                        queue.push(n);
                    }
                }
            }
        }
    }
    return { liberties, group };
};

const playMove = (board: any[][], moveR: number, moveC: number, player: string) => {
    if (moveR < 0 || moveR >= board.length || moveC < 0 || moveC >= board.length) {
        return board.map(row => [...row]);
    }

    let newBoard = board.map(row => [...row]);
    newBoard[moveR][moveC] = player;

    const opp = player === 'B' ? 'W' : 'B';
    const size = board.length;

    const neighbors = [
        { r: moveR - 1, c: moveC }, { r: moveR + 1, c: moveC },
        { r: moveR, c: moveC - 1 }, { r: moveR, c: moveC + 1 }
    ];

    for (const n of neighbors) {
        if (n.r >= 0 && n.r < size && n.c >= 0 && n.c < size) {
            if (newBoard[n.r][n.c] === opp) {
                const { liberties, group } = getLiberties(newBoard, n.r, n.c);
                if (liberties === 0) {
                    for (const stone of group) {
                        newBoard[stone.r][stone.c] = null;
                    }
                }
            }
        }
    }

    const { liberties } = getLiberties(newBoard, moveR, moveC);
    if (liberties === 0) return null;

    return newBoard;
};

interface TsumegoBoardProps {
    puzzle: Puzzle;
    isGhostMode: boolean;
    key?: string | number | null;
}
const TsumegoBoard = ({ puzzle, isGhostMode }: TsumegoBoardProps) => {
    const router = useRouter();
    const size = puzzle.board_width || 19;

    const [boardState, setBoardState] = useState(() => {
        const initialBoard = Array(size).fill(null).map(() => Array(size).fill(null));
        const stones = puzzle?.normalized_json?.board?.stones;
        if (stones) {
            (stones['B'] || []).forEach(([r, c]: [number, number]) => {
                if (r >= 0 && r < size && c >= 0 && c < size) initialBoard[r][c] = 'B';
            });
            (stones['W'] || []).forEach(([r, c]: [number, number]) => {
                if (r >= 0 && r < size && c >= 0 && c < size) initialBoard[r][c] = 'W';
            });
        }
        return initialBoard;
    });

    const crop = React.useMemo(() => {
        const stones: number[][] = [];
        const b = puzzle?.normalized_json?.board?.stones;
        if (b) {
            (b['B'] || []).forEach(([r, c]: [number, number]) => stones.push([r, c]));
            (b['W'] || []).forEach(([r, c]: [number, number]) => stones.push([r, c]));
        }
        return getCrop(stones, size);
    }, [puzzle, size]);

    const [currentPlayer, setCurrentPlayer] = useState<'B' | 'W'>(puzzle.to_play || 'B');
    const [history, setHistory] = useState<any[]>([]);

    const [currentNode, setCurrentNode] = useState<any>(null);
    const [solveStatus, setSolveStatus] = useState<'playing' | 'correct' | 'wrong'>('playing');
    const [hintCell, setHintCell] = useState<{ r: number, c: number } | null>(null);
    const [hasUsedHint, setHasUsedHint] = useState<boolean>(false);

    const [isProcessingMove, setIsProcessingMove] = useState(false);
    const processingTimeoutRef = React.useRef<any>(null);
    const botMoveTimeoutRef = React.useRef<any>(null);
    const startTimeRef = React.useRef<number>(Date.now());

    useEffect(() => {
        if (puzzle) startTimeRef.current = Date.now();
    }, [puzzle]);

    const submitAttempt = async (isCorrect: boolean) => {
        const timeSpent = Math.floor((Date.now() - startTimeRef.current) / 1000);
        const token = localStorage.getItem('token');
        if (!token || !puzzle?.id) return;

        try {
            await fetch(`http://89.167.122.76:8800/v1/tsumego/puzzles/${puzzle.id}/attempts`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    is_correct: isCorrect,
                    used_hint: hasUsedHint,
                    time_spent_seconds: timeSpent > 0 ? timeSpent : 1
                })
            });
        } catch (err) {
            console.error('Failed to submit attempt', err);
        }
    };

    const initialBoardMap = React.useMemo(() => {
        const map = Array(size).fill(false).map(() => Array(size).fill(false));
        const stones = puzzle?.normalized_json?.board?.stones;
        if (stones) {
            (stones['B'] || []).forEach(([r, c]: [number, number]) => { if (r >= 0 && r < size && c >= 0 && c < size) map[r][c] = true; });
            (stones['W'] || []).forEach(([r, c]: [number, number]) => { if (r >= 0 && r < size && c >= 0 && c < size) map[r][c] = true; });
        }
        return map;
    }, [puzzle, size]);

    useEffect(() => {
        if (puzzle?.normalized_json?.raw_payload?.puzzle?.move_tree) {
            setCurrentNode(puzzle.normalized_json.raw_payload.puzzle.move_tree);
        }
    }, [puzzle]);

    const resetBoard = () => {
        const initialBoard = Array(size).fill(null).map(() => Array(size).fill(null));
        const stones = puzzle?.normalized_json?.board?.stones;
        if (stones) {
            (stones['B'] || []).forEach(([r, c]: [number, number]) => {
                if (r >= 0 && r < size && c >= 0 && c < size) initialBoard[r][c] = 'B';
            });
            (stones['W'] || []).forEach(([r, c]: [number, number]) => {
                if (r >= 0 && r < size && c >= 0 && c < size) initialBoard[r][c] = 'W';
            });
        }
        setBoardState(initialBoard);
        setHistory([]);
        setCurrentPlayer(puzzle.to_play || 'B');
        setSolveStatus('playing');
        setHintCell(null);
        setHasUsedHint(false);
        startTimeRef.current = Date.now();

        if (puzzle?.normalized_json?.raw_payload?.puzzle?.move_tree) {
            setCurrentNode(puzzle.normalized_json.raw_payload.puzzle.move_tree);
        }
    };

    const handleCellClick = (r: number, c: number) => {
        if (isProcessingMove || boardState[r][c] !== null) return;

        setHintCell(null);
        setIsProcessingMove(true);

        const stateBeforePlayerMove = {
            board: boardState,
            node: currentNode,
            player: currentPlayer
        };

        const newBoard = playMove(boardState, r, c, currentPlayer);
        if (!newBoard) return;

        setBoardState(newBoard);
        setHistory([...history, stateBeforePlayerMove]);

        const p = currentPlayer;
        const botPlayer = currentPlayer === 'B' ? 'W' : 'B';
        setCurrentPlayer(botPlayer);

        // If puzzle is already over, just allow free play (don't check AST)
        if (solveStatus === 'correct' || solveStatus === 'wrong') {
            setIsProcessingMove(false);
            return;
        }



        if (currentNode && currentNode.branches) {
            const moveBranch = currentNode.branches.find((branch: any) => branch.x === c && branch.y === r);

            if (moveBranch) {
                setCurrentNode(moveBranch);

                if (moveBranch.wrong_answer) {
                    processingTimeoutRef.current = setTimeout(() => { setSolveStatus('wrong'); submitAttempt(false); setIsProcessingMove(false); }, 2500);
                } else if (moveBranch.correct_answer) {
                    setSolveStatus('correct');
                    submitAttempt(true);
                    setIsProcessingMove(false);
                } else if (moveBranch.branches && moveBranch.branches.length > 0) {
                    botMoveTimeoutRef.current = setTimeout(() => {
                        const botNode = moveBranch.branches[0];
                        const bb = playMove(newBoard, botNode.y, botNode.x, botPlayer);
                        if (bb) {
                            const stateBeforeBotMove = {
                                board: newBoard,
                                node: moveBranch,
                                player: botPlayer
                            };
                            setBoardState(bb);
                            setHistory(prev => [...prev, stateBeforeBotMove]);
                            setCurrentPlayer(p);
                            setCurrentNode(botNode);

                            if (botNode.wrong_answer || !botNode.branches || botNode.branches.length === 0) {
                                processingTimeoutRef.current = setTimeout(() => { setSolveStatus('wrong'); submitAttempt(false); setIsProcessingMove(false); }, 2500);
                            } else if (botNode.correct_answer) {
                                setSolveStatus('correct');
                                submitAttempt(true);
                                setIsProcessingMove(false);
                            } else {
                                setIsProcessingMove(false);
                            }
                        } else {
                            setIsProcessingMove(false);
                        }
                    }, 1200);
                } else {
                    processingTimeoutRef.current = setTimeout(() => { setSolveStatus('wrong'); submitAttempt(false); setIsProcessingMove(false); }, 2500);
                }
            } else {
                processingTimeoutRef.current = setTimeout(() => { setSolveStatus('wrong'); submitAttempt(false); setIsProcessingMove(false); }, 2500);
            }
        } else {
            processingTimeoutRef.current = setTimeout(() => { setSolveStatus('wrong'); submitAttempt(false); setIsProcessingMove(false); }, 2500);
        }
    };

    const [isTransitioning, setIsTransitioning] = useState(false);

    const handleNextPuzzle = () => {
        setIsTransitioning(true);
        // We will pass this event up to the parent component that manages the Mix queue
        if ((window as any).onNextPuzzleMixMode) {
            (window as any).onNextPuzzleMixMode();
            setIsTransitioning(false);
        }
    };

    const handleUndo = () => {
        if (history.length === 0) return;

        let popCount = 1;
        let lastState = history[history.length - 1];

        // If in free play (after puzzle ended), we just pop one move (the user's free play move)
        // If still in playing state, we might pop 2 moves (bot's response)
        if (solveStatus === 'playing' && lastState.player !== puzzle?.normalized_json?.raw_payload?.puzzle?.player_turn && history.length > 1) {
            popCount = 2;
            lastState = history[history.length - 2];
        }

        setBoardState(lastState.board);
        setCurrentNode(lastState.node);
        setCurrentPlayer(lastState.player);

        // If we undo a move that was made during free play, we shouldn't necessarily change the solveStatus back to playing unless we actually crossed the boundary.
        // Actually, to keep it simple: if we undo, and the previous state was before the puzzle ended, we should revert solve status.
        // It's safer to just let the user free-play and if they want to try again they hit "Try Again" or "Restart", but let's allow undoing into the playing state only if they undo the move that finished the puzzle.
        // Actually, let's keep it simple: Undo always works. If they are in 'correct' or 'wrong' and undo, we'll keep them in that state unless they hit "Try Again". 
        // Oh wait, if they made a wrong move, the node has 'wrong_answer'. If they undo it, they should be back to 'playing'.
        // So let's re-evaluate solve status based on the node we are reverting to.
        let newStatus: 'playing' | 'correct' | 'wrong' = 'playing';
        if (lastState.node && lastState.node.correct_answer && history.length - popCount >= 1) {
            // Wait, if the node we reverted TO is correct_answer, it's correct.
            newStatus = 'correct';
        } else if (lastState.node && lastState.node.wrong_answer) {
            newStatus = 'wrong';
        }
        setSolveStatus(newStatus);
        setHintCell(null);
        setIsProcessingMove(false);
        if (processingTimeoutRef.current) clearTimeout(processingTimeoutRef.current);
        if (botMoveTimeoutRef.current) clearTimeout(botMoveTimeoutRef.current);

        setHistory(history.slice(0, -popCount));
    };

    const handleHint = () => {
        if (!currentNode || solveStatus !== 'playing') return;

        // Find the absolute best branch (with correct_answer)
        const findCorrectBranch = (node: any): any => {
            if (node.correct_answer) return node;
            if (!node.branches) return null;
            for (const b of node.branches) {
                const found = findCorrectBranch(b);
                if (found) return b;
            }
            return null;
        };

        // Find a safe fallback branch (no wrong_answer immediately)
        const findSafeBranch = (node: any): any => {
            if (!node.branches || node.branches.length === 0) return null;
            // Prefer a branch that isn't explicitly marked wrong
            for (const b of node.branches) {
                if (!b.wrong_answer) return b;
            }
            // If all are marked wrong, something is weird, just return the first
            return node.branches[0];
        };

        let bestMove = findCorrectBranch(currentNode);
        if (!bestMove) {
            bestMove = findSafeBranch(currentNode);
        }

        if (bestMove && bestMove.x !== undefined && bestMove.y !== undefined) {
            setHasUsedHint(true);
            setHintCell({ r: bestMove.y, c: bestMove.x });
            setTimeout(() => setHintCell(null), 3000);
        }
    };

    const pos = (idx: number) => `${(idx / (crop.viewSize - 1)) * 100}%`;
    const stoneSize = `${90 / crop.viewSize}%`;

    return (
        <div className="w-full flex flex-col items-center antialiased">
            <style>{`
                @keyframes ghostFade {
                    0% { opacity: 1; }
                    80% { opacity: 1; }
                    100% { opacity: 0; }
                }
                .ghost-fade {
                    animation: ghostFade 6s forwards;
                }
            `}</style>

            {/* STATUS AND CONTROLS */}
            <div className="w-full max-w-[800px] mb-8 flex flex-col sm:flex-row items-center justify-between gap-4">

                {/* Play Status Cards */}
                <div className="flex-1 w-full relative h-[64px]">
                    {solveStatus === 'playing' && (
                        <div className="absolute inset-0 flex items-center justify-start anim-fade-in gap-3">
                            {history.length > 0 && (
                                <button
                                    onClick={handleUndo}
                                    className="flex items-center gap-2 px-5 py-2.5 rounded-full border border-white/10 bg-[#1A1A1A] hover:bg-white/5 text-gray-300 font-medium shadow-lg transition-colors"
                                >
                                    <Undo2 className="w-4 h-4" /> Undo Turn
                                </button>
                            )}
                            <button
                                onClick={handleHint}
                                className="flex items-center gap-2 px-5 py-2.5 rounded-full border border-[#E9C46A]/20 bg-[#E9C46A]/10 hover:bg-[#E9C46A]/20 text-[#E9C46A] font-medium shadow-lg transition-colors"
                            >
                                <Lightbulb className="w-4 h-4" /> Hint
                            </button>
                        </div>
                    )}

                    {solveStatus === 'wrong' && (
                        <div className="absolute inset-0 flex items-center justify-start gap-4 anim-fade-in">
                            {history.length > 0 && (
                                <button
                                    onClick={handleUndo}
                                    className="flex items-center gap-2 px-5 py-2.5 rounded-full border border-white/10 bg-[#1A1A1A] hover:bg-white/5 text-gray-300 font-medium shadow-lg transition-colors"
                                >
                                    <Undo2 className="w-4 h-4" /> Undo Mode
                                </button>
                            )}
                            <div className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-red-500/10 border border-red-500/20 text-red-500 font-medium">
                                <XCircle className="w-5 h-5" /> Incorrect
                            </div>
                            <button
                                onClick={resetBoard}
                                className="flex items-center gap-2 px-5 py-2.5 rounded-full font-medium bg-[#1A1A1A] hover:bg-white/10 text-white border border-white/10 shadow-lg transition-all"
                            >
                                <RotateCcw className="w-4 h-4" /> Try Again
                            </button>
                        </div>
                    )}

                    {solveStatus === 'correct' && (
                        <div className="absolute inset-0 flex items-center justify-start gap-4 anim-fade-in w-full">
                            <div className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-green-500/10 border border-green-500/20 text-green-500 font-medium">
                                <CheckCircle2 className="w-5 h-5" /> Solved
                            </div>
                            {history.length > 0 && (
                                <button
                                    onClick={handleUndo}
                                    className="flex items-center gap-2 px-4 py-2 bg-[#1A1A1A] hover:bg-[#2A2A2A] text-white border border-white/10 rounded-full font-medium transition-colors shadow-lg"
                                >
                                    <Undo2 className="w-4 h-4" /> Undo
                                </button>
                            )}
                            <button
                                onClick={handleNextPuzzle}
                                disabled={isTransitioning}
                                className="flex items-center gap-2 px-6 py-2.5 bg-[#E9C46A] hover:bg-[#d4b059] text-black rounded-full font-bold transition-colors shadow-lg disabled:opacity-50"
                            >
                                {isTransitioning ? 'Loading...' : 'Next Puzzle'} <SkipForward className="w-4 h-4" />
                            </button>
                        </div>
                    )}
                </div>

                {/* Current Node Info */}
                {currentNode?.text && (
                    <div className="bg-[#1A1A1A] border border-white/10 text-[#8B8B8B] px-5 py-2.5 rounded-full shadow-lg flex items-center gap-2 text-sm sm:max-w-xs truncate">
                        <Info className="w-4 h-4 text-[#E9C46A]" />
                        <span>{currentNode.text}</span>
                    </div>
                )}
            </div>

            {/* MAIN BOARD */}
            <div className="relative aspect-square w-full sm:w-[85vw] md:w-[65vw] lg:w-[70vw] max-w-[720px] max-h-[75vh] flex-shrink-0 bg-[#E0B86E] p-2 sm:p-5 border-[10px] sm:border-[16px] border-[#3F2B1A] shadow-2xl shadow-black/80 rounded-sm select-none mx-auto overflow-hidden">
                <div className="absolute inset-0 opacity-20 pointer-events-none mix-blend-multiply" style={{ backgroundImage: "url('https://www.transparenttextures.com/patterns/wood-pattern.png')" }}></div>
                <div className="absolute top-4 sm:top-6 left-4 sm:left-6 right-4 sm:right-6 bottom-4 sm:bottom-6 border-2 border-[#543E23]">
                    {/* Grid Lines */}
                    {Array.from({ length: crop.viewSize }).map((_, i) => (
                        <React.Fragment key={i}>
                            <div className="absolute bg-[#543E23]" style={{ top: pos(i), left: 0, right: 0, height: '1.5px' }} />
                            <div className="absolute bg-[#543E23]" style={{ left: pos(i), top: 0, bottom: 0, width: '1.5px' }} />
                        </React.Fragment>
                    ))}

                    {/* Star Points */}
                    {size === 19 && [3, 9, 15].map(r => [3, 9, 15].map(c => {
                        if (r >= crop.minR && r <= crop.maxR && c >= crop.minC && c <= crop.maxC) {
                            return (
                                <div key={`star-${r}-${c}`}
                                    className="absolute w-2 h-2 sm:w-2.5 sm:h-2.5 bg-[#2B1D11] rounded-full transform -translate-x-1/2 -translate-y-1/2"
                                    style={{ top: pos(r - crop.minR), left: pos(c - crop.minC) }}
                                ></div>
                            );
                        }
                        return null;
                    }))}

                    {/* Stones */}
                    {boardState.map((row, r) => row.map((stone, c) => {
                        if (r >= crop.minR && r <= crop.maxR && c >= crop.minC && c <= crop.maxC) {
                            const isLastMove = history.length > 0 && history[history.length - 1].row === r && history[history.length - 1].col === c;
                            return (
                                <div
                                    key={`cell-${r}-${c}`}
                                    className="absolute transform -translate-x-1/2 -translate-y-1/2 flex items-center justify-center cursor-pointer group rounded-full"
                                    style={{
                                        top: pos(r - crop.minR),
                                        left: pos(c - crop.minC),
                                        width: stoneSize,
                                        height: stoneSize
                                    }}
                                    onClick={() => handleCellClick(r, c)}
                                >
                                    {/* Hover Ghost Stone */}
                                    {!stone && (
                                        <div className={`w-[98%] h-[98%] rounded-full opacity-0 group-hover:opacity-40 transition-opacity ${currentPlayer === 'B' ? 'bg-black shadow-lg' : 'bg-white shadow-[inset_-2px_-2px_4px_rgba(0,0,0,0.2)]'}`}></div>
                                    )}

                                    {/* Hint Stone */}
                                    {hintCell && hintCell.r === r && hintCell.c === c && !stone && (
                                        <div className="absolute w-[80%] h-[80%] rounded-full animate-bounce z-20 flex items-center justify-center">
                                            <div className="w-full h-full rounded-full bg-[#E9C46A]/90 shadow-[0_0_25px_rgba(233,196,106,1)] border-4 border-white flex items-center justify-center">
                                                <div className="w-[40%] h-[40%] rounded-full bg-white opacity-80 blur-[1px]"></div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Placed Stone */}
                                    {stone && (
                                        <div className={`w-[98%] h-[98%] rounded-full shadow-[2px_4px_6px_rgba(0,0,0,0.4)] ${stone === 'B' ? 'bg-gradient-to-br from-[#444] to-[#111]' : 'bg-gradient-to-br from-[#fff] to-[#ccd]'} ${isGhostMode && !initialBoardMap[r][c] ? 'ghost-fade pointer-events-none' : ''}`}>
                                            <div className={`absolute top-[15%] left-[20%] w-[35%] h-[35%] rounded-full ${stone === 'B' ? 'bg-white/10' : 'bg-white/80'}`}></div>
                                        </div>
                                    )}

                                    {/* Last Move Indicator */}
                                    {isLastMove && (
                                        <div className={`absolute w-[30%] h-[30%] rounded-full border-[2.5px] ${stone === 'B' ? 'border-white/80' : 'border-black/50'} ${isGhostMode && !initialBoardMap[r][c] ? 'ghost-fade pointer-events-none' : ''}`}></div>
                                    )}
                                </div>
                            );
                        }
                        return null;
                    }))}
                </div>
            </div>
        </div>
    );
};

export default function MixPractice() {
    const router = useRouter();

    const [puzzleQueue, setPuzzleQueue] = useState<Puzzle[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [isGhostMode, setIsGhostMode] = useState(false);

    // Bind the global next puzzle event to our state manager
    useEffect(() => {
        (window as any).onNextPuzzleMixMode = () => {
            setPuzzleQueue(prev => prev.slice(1));
        };
        return () => {
            (window as any).onNextPuzzleMixMode = undefined;
        };
    }, []);

    useEffect(() => {
        const saved = localStorage.getItem('tsumego_ghost_mode');
        if (saved) setIsGhostMode(saved === 'true');
    }, []);

    const toggleGhostMode = () => {
        const next = !isGhostMode;
        setIsGhostMode(next);
        localStorage.setItem('tsumego_ghost_mode', String(next));
    };

    const fetchMixPuzzles = React.useCallback(async () => {
        const token = localStorage.getItem('token');
        if (!token) {
            setError("You must be logged in to use Adaptive Mix mode.");
            setLoading(false);
            return;
        }

        try {
            const res = await fetch(`http://89.167.122.76:8800/v1/tsumego/puzzles/mix?limit=10`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();

            if (data && data.length > 0) {
                // Pre-fetch the normalized_json for all returned summaries rapidly so the UI doesn't stutter when advancing
                const fullPuzzles = await Promise.all(
                    data.map((summary: any) =>
                        fetch(`http://89.167.122.76:8800/v1/tsumego/puzzles/${summary.id}`).then(r => r.json())
                    )
                );

                setPuzzleQueue(prev => [...prev, ...fullPuzzles]);
                setLoading(false);
            } else {
                if (puzzleQueue.length === 0) {
                    setError("No suitable puzzles found for your rating range. You might have solved them all!");
                    setLoading(false);
                }
            }
        } catch (err) {
            console.error(err);
            if (puzzleQueue.length === 0) setError('Failed to load mixed puzzles.');
        }
    }, [puzzleQueue.length]);

    // Initial load and replenishment trigger
    useEffect(() => {
        if (loading && puzzleQueue.length === 0) {
            fetchMixPuzzles();
        } else if (puzzleQueue.length > 0 && puzzleQueue.length <= 3) {
            fetchMixPuzzles();
        }
    }, [puzzleQueue.length, loading, fetchMixPuzzles]);

    const puzzle = puzzleQueue[0] || null;

    if (loading && puzzleQueue.length === 0) {
        return (
            <div className="min-h-screen bg-[#111111] flex flex-col items-center justify-center">
                <div className="w-10 h-10 border-4 border-white/10 border-t-[#E9C46A] rounded-full animate-spin mb-4"></div>
                <p className="text-[#8B8B8B] font-medium tracking-wide">Finding matches for your skill level...</p>
            </div>
        );
    }

    if (error || !puzzle) {
        return (
            <div className="min-h-screen bg-[#111111] flex flex-col items-center justify-center p-6 text-center text-white">
                <XCircle className="w-16 h-16 text-red-500 mb-6" />
                <h1 className="text-3xl font-semibold mb-3 tracking-tight">Puzzle Not Found</h1>
                <p className="text-[#8B8B8B] mb-8 max-w-md">{error || 'This puzzle might have been removed or the ID is invalid.'}</p>
                <Link href="/tsumego" className="px-8 py-3 bg-[#1A1A1A] border border-white/10 text-white rounded-xl font-medium hover:border-white/30 transition shadow-lg">
                    Return to Library
                </Link>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#111111] text-[#FAFAFC] selection:bg-[#E9C46A] font-sans flex flex-col">
            <Head>
                <title>{puzzle.goal_type || 'Tsumego'} - KAI</title>
            </Head>

            {/* SUB-HEADER */}
            <div className="fixed top-16 w-full z-40 bg-[#111111]/90 backdrop-blur-md border-b border-white/5">
                <div className="max-w-[1400px] mx-auto px-6 h-12 flex items-center justify-between">
                    <Link href="/tsumego" className="text-[#8B8B8B] hover:text-white transition-colors flex items-center gap-2 text-sm font-medium">
                        <ArrowLeft className="w-4 h-4" /> Library
                    </Link>

                    <div className="hidden md:flex flex-col items-center justify-center text-xs font-medium">
                        <span className="text-white">{puzzle.collection_name || "Daily Challenge"}</span>
                        <span className="text-[#E9C46A] text-[10px]">#{puzzle.source_key}</span>
                    </div>

                    <div className="flex items-center gap-3">
                        <div className="flex flex-col items-end">
                            <span className="text-xs font-medium text-[#8B8B8B]">Ghost Mode</span>
                        </div>
                        <button
                            onClick={toggleGhostMode}
                            className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${isGhostMode ? 'bg-[#E9C46A]' : 'bg-white/10'}`}
                        >
                            <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${isGhostMode ? 'translate-x-4' : 'translate-x-0'}`} />
                        </button>
                    </div>
                </div>
            </div>

            {/* MAIN CONTENT AREA */}
            <main className="flex-1 w-full max-w-[1400px] mx-auto px-4 sm:px-6 pt-36 pb-12 flex flex-col xl:flex-row items-center xl:items-start justify-center gap-12 xl:gap-20">

                {/* Center Stage: Board & Controls */}
                <div className="flex-1 w-full flex flex-col items-center relative">
                    {/* Optional loading fade when id changes, though currently handled gracefully */}
                    <TsumegoBoard key={puzzle.id} puzzle={puzzle} isGhostMode={isGhostMode} />
                </div>

                {/* Right Panel: Puzzle Details Card */}
                <div className="w-full max-w-[400px] xl:w-[350px] shrink-0">
                    <div className="bg-[#1A1A1A] rounded-2xl p-6 border border-white/5 shadow-2xl flex flex-col gap-6 sticky top-28">
                        <div>
                            <span className="inline-block px-3 py-1 bg-white/5 border border-white/10 text-white rounded-lg text-xs font-bold tracking-widest uppercase mb-4">
                                {puzzle.difficulty_rank || '10k'}
                            </span>
                            <h2 className="text-2xl font-semibold tracking-tight text-white mb-2">
                                Goal: {puzzle.to_play === 'W' ? 'White to live' : 'Black to live'}
                            </h2>
                            <p className="text-[#8B8B8B] text-sm leading-relaxed">
                                {puzzle.normalized_json?.raw_payload?.puzzle?.puzzle_description
                                    ? puzzle.normalized_json.raw_payload.puzzle.puzzle_description.replace(/<[^>]*>?/gm, '')
                                    : 'Read the board carefully. The opponent will try to refute your moves. Find the correct sequence to succeed.'}
                            </p>
                        </div>

                        <div className="h-px w-full bg-white/5"></div>

                        <div className="flex flex-col gap-3 text-sm">
                            <div className="flex justify-between items-center text-[#8B8B8B]">
                                <span>Collection</span>
                                <span className="text-white text-right max-w-[200px] truncate" title={puzzle.collection_name}>{puzzle.collection_name || 'Mixed'}</span>
                            </div>
                            <div className="flex justify-between items-center text-[#8B8B8B]">
                                <span>To Play</span>
                                <span className="text-white flex items-center gap-2">
                                    <div className={`w-3 h-3 rounded-full ${puzzle.to_play === 'B' ? 'bg-black border border-white/20' : 'bg-white'}`}></div>
                                    {puzzle.to_play === 'B' ? 'Black' : 'White'}
                                </span>
                            </div>
                            <div className="flex justify-between items-center text-[#8B8B8B]">
                                <span>Board Size</span>
                                <span className="text-white">{puzzle.board_width}x{puzzle.board_width}</span>
                            </div>
                        </div>

                        {puzzle.tags && puzzle.tags.length > 0 && (
                            <>
                                <div className="h-px w-full bg-white/5"></div>
                                <div>
                                    <span className="text-xs text-[#8B8B8B] uppercase tracking-wider font-semibold mb-3 block">Related Tags</span>
                                    <div className="flex flex-wrap gap-2">
                                        {puzzle.tags.map((t, i) => (
                                            <span key={i} className="px-3 py-1 bg-white/5 rounded-full text-xs text-gray-300 border border-white/5 truncate max-w-full">
                                                {t.replace(/_/g, ' ')}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                </div>

            </main>
        </div>
    );
}
