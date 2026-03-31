import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { ChevronLeft, ArrowLeft, Undo2, CheckCircle2, XCircle, Info, SkipForward, RotateCcw, Lightbulb } from 'lucide-react';
import { GoBoard } from '../../components/GoBoard';

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
    const originalSize = puzzle.board_width || 19;

    const size = React.useMemo(() => {
        let maxR = -1;
        let maxC = -1;
        const stones = puzzle?.normalized_json?.board?.stones;
        if (stones) {
            ['B', 'W'].forEach(color => {
                (stones[color] || []).forEach(([r, c]: [number, number]) => {
                    if (r > maxR) maxR = r;
                    if (c > maxC) maxC = c;
                });
            });
        }

        const traverseNode = (node: any) => {
            if (node.move && Array.isArray(node.move) && node.move.length === 2) {
                const [r, c] = node.move;
                if (r > maxR) maxR = r;
                if (c > maxC) maxC = c;
            }
            if (node.children) {
                node.children.forEach(traverseNode);
            }
        };

        if (puzzle?.normalized_json?.solution) {
            traverseNode(puzzle.normalized_json.solution);
        }

        if (maxR < 9 && maxC < 9 && originalSize >= 9) return 9;
        if (maxR < 13 && maxC < 13 && originalSize >= 13) return 13;
        return originalSize;
    }, [originalSize, puzzle]);

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

    const [boardPx, setBoardPx] = useState(600);

    useEffect(() => {
        const updateSize = () => {
            const w = window.innerWidth;
            const h = window.innerHeight;
            // Tsumego logic limits max bound
            const maxSize = Math.min(w * 0.95, h * 0.7, 720);
            setBoardPx(maxSize);
        };
        updateSize();
        window.addEventListener('resize', updateSize);
        return () => window.removeEventListener('resize', updateSize);
    }, []);
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

    const initialBoardMap = React.useMemo(() => {
        const initialMap = Array(size).fill(false).map(() => Array(size).fill(false));
        const stones = puzzle?.normalized_json?.board?.stones;
        if (stones) {
            (stones['B'] || []).forEach(([r, c]: [number, number]) => {
                if (r >= 0 && r < size && c >= 0 && c < size) initialMap[r][c] = true;
            });
            (stones['W'] || []).forEach(([r, c]: [number, number]) => {
                if (r >= 0 && r < size && c >= 0 && c < size) initialMap[r][c] = true;
            });
        }
        return initialMap;
    }, [puzzle, size]);

    useEffect(() => {
        if (!puzzle.normalized_json?.solution_tree) return;
        const initialNodeId = puzzle.normalized_json.solution_tree.root || 'root';
        const initialNode = puzzle.normalized_json.solution_tree.nodes[initialNodeId];
        setCurrentNode(initialNode || null);
    }, [puzzle]);

    const performMove = (r: number, c: number, color: 'B' | 'W') => {
        setBoardState(prev => {
            const next = prev.map(row => [...row]);
            next[r][c] = color;
            const updated = playMove(next, r, c, color); // Using existing playMove for captures
            return updated || next;
        });
    };

    const parseMoveStr = (moveStr: string, boardSize: number) => {
        if (!moveStr || moveStr.length < 2) return null;
        const colChar = moveStr.charCodeAt(0);
        const col = colChar >= 97 ? colChar - 97 : colChar - 65; // 'a' or 'A' to 0
        const row = boardSize - parseInt(moveStr.substring(1));
        if (isNaN(row) || col < 0 || col >= boardSize || row < 0 || row >= boardSize) return null;
        return { r: row, c: col };
    };

    const handleUndo = () => {
        if (history.length === 0 || isProcessingMove) return;

        setHistory(prev => {
            const newHistory = [...prev];
            // Remove bot move if it exists
            if (newHistory.length > 0 && newHistory[newHistory.length - 1].color !== puzzle.to_play) {
                newHistory.pop();
            }
            // Remove user move
            if (newHistory.length > 0) {
                newHistory.pop();
            }
            return newHistory;
        });
    };

    useEffect(() => {
        if (!puzzle) return;

        const initialBoard = Array(size).fill(null).map(() => Array(size).fill(null));
        const stones = puzzle?.normalized_json?.board?.stones;
        if (stones) {
            (stones['B'] || []).forEach(([r, c]: [number, number]) => { if (r >= 0 && r < size && c >= 0 && c < size) initialBoard[r][c] = 'B'; });
            (stones['W'] || []).forEach(([r, c]: [number, number]) => { if (r >= 0 && r < size && c >= 0 && c < size) initialBoard[r][c] = 'W'; });
        }

        let tempBoard = initialBoard;
        let tempNodeId = puzzle.normalized_json?.solution_tree?.root || 'root';
        let tempNode = puzzle.normalized_json?.solution_tree?.nodes[tempNodeId];

        history.forEach(move => {
            tempBoard[move.row][move.col] = move.color;
            tempBoard = playMove(tempBoard, move.row, move.col, move.color) || tempBoard;
            if (tempNode && tempNode.children && tempNode.children.length > 0) {
                const childId = tempNode.children.find((cId: string) => {
                    const cNode = puzzle.normalized_json?.solution_tree?.nodes[cId];
                    if (!cNode || !cNode.move) return false;
                    const cMoveStr = typeof cNode.move === 'string' ? cNode.move : (cNode.move[move.color] || cNode.move.B || cNode.move.W);
                    if (!cMoveStr) return false;
                    const parsed = parseMoveStr(cMoveStr, size);
                    return parsed && parsed.r === move.row && parsed.c === move.col;
                });
                if (childId) {
                    tempNode = puzzle.normalized_json?.solution_tree?.nodes[childId];
                } else {
                    tempNode = null;
                }
            } else {
                tempNode = null;
            }
        });

        setBoardState(tempBoard);
        setCurrentNode(tempNode);
        setCurrentPlayer((history.length % 2 === 0) ? puzzle.to_play! : (puzzle.to_play === 'B' ? 'W' : 'B'));

        setHintCell(null);

        if (tempNode) {
            checkCompletion(tempNode);
            if (history.length % 2 !== 0 && solveStatus === 'playing') {
                triggerBotMove(tempNode);
            }
        } else if (history.length > 0) {
            setSolveStatus('wrong');
            setIsProcessingMove(false);
        }

    }, [history, puzzle, size]);

    useEffect(() => {
        return () => {
            if (processingTimeoutRef.current) clearTimeout(processingTimeoutRef.current);
            if (botMoveTimeoutRef.current) clearTimeout(botMoveTimeoutRef.current);
        };
    }, []);

    const triggerBotMove = (node: any) => {
        setIsProcessingMove(true);

        const executeBotResponse = (targetNodeId: string) => {
            const children = puzzle.normalized_json?.solution_tree?.nodes[targetNodeId]?.children || [];
            if (children.length > 0) {
                const botNodeId = children[Math.floor(Math.random() * children.length)];
                const botNode = puzzle.normalized_json?.solution_tree?.nodes[botNodeId];
                if (botNode && botNode.move) {
                    const botColor = (puzzle.to_play === 'B') ? 'W' : 'B';
                    const botMoveStr = typeof botNode.move === 'string' ? botNode.move : (botNode.move[botColor] || botNode.move.W || botNode.move.B);
                    const parsed = parseMoveStr(botMoveStr, size);
                    if (parsed) {
                        setHistory(prev => [...prev, { row: parsed.r, col: parsed.c, color: botColor }]);
                        setCurrentPlayer(puzzle.to_play!);
                        checkCompletion(botNode);
                    }
                }
            }
            setIsProcessingMove(false);
        };

        const randomDelay = Math.random() < 0.2 ? Math.floor(Math.random() * 200) + 100 : Math.floor(Math.random() * 400) + 400;

        botMoveTimeoutRef.current = setTimeout(() => {
            const requiresReaction = node.children?.some((cId: string) => {
                const c = puzzle.normalized_json?.solution_tree?.nodes[cId];
                return c && c.move;
            });

            if (requiresReaction) {
                executeBotResponse(node.id);
            } else {
                checkCompletion(node);
                setIsProcessingMove(false);
            }
        }, randomDelay);
    };

    const checkCompletion = (node: any) => {
        if (!node) {
            setSolveStatus('wrong');
            return;
        }

        if (node.is_correct || node.status === 'CORRECT') {
            setSolveStatus('correct');
        } else if (node.is_wrong || node.status === 'WRONG') {
            setSolveStatus('wrong');
        } else if (!node.children || node.children.length === 0) {
            const hasMoveText = node.text?.toLowerCase().includes('wrong') || node.text?.toLowerCase().includes('fail');
            if (hasMoveText) {
                setSolveStatus('wrong');
            } else {
                setSolveStatus('correct');
            }
        }
    };

    const getHintCellFromNode = (node: any): { r: number, c: number } | null => {
        if (!puzzle.normalized_json?.solution_tree || !node || !node.children) return null;

        const findCorrectBranch = (nId: string): string | null => {
            const n = puzzle.normalized_json!.solution_tree.nodes[nId];
            if (!n) return null;
            if (n.is_correct || n.status === 'CORRECT') return nId;
            if (!n.children || n.children.length === 0) {
                const hasWrongTxt = n.text?.toLowerCase().includes('wrong') || n.text?.toLowerCase().includes('fail');
                return hasWrongTxt ? null : nId;
            }
            for (const cId of n.children) {
                const res = findCorrectBranch(cId);
                if (res) return cId;
            }
            return null;
        };

        for (const childId of node.children) {
            const correctPathNodeId = findCorrectBranch(childId);
            if (correctPathNodeId) {
                const childNode = puzzle.normalized_json.solution_tree.nodes[childId];
                if (childNode && childNode.move) {
                    const cMoveStr = typeof childNode.move === 'string' ? childNode.move : (childNode.move[puzzle.to_play!] || childNode.move.B || childNode.move.W);
                    if (cMoveStr) {
                        return parseMoveStr(cMoveStr, size);
                    }
                }
            }
        }

        for (const childId of node.children) {
            const childNode = puzzle.normalized_json.solution_tree.nodes[childId];
            if (childNode && childNode.move && !(childNode.is_wrong || childNode.status === 'WRONG')) {
                const cMoveStr = typeof childNode.move === 'string' ? childNode.move : (childNode.move[puzzle.to_play!] || childNode.move.B || childNode.move.W);
                if (cMoveStr) {
                    return parseMoveStr(cMoveStr, size);
                }
            }
        }

        return null; // Fallback
    };


    const handleHint = () => {
        if (solveStatus !== 'playing' || isProcessingMove) return;

        let searchNode = currentNode;
        if (!searchNode && history.length > 0) {
            setHistory(prev => {
                const newHistory = [...prev];
                if (newHistory.length > 0) newHistory.pop();
                if (newHistory.length > 0 && newHistory[newHistory.length - 1].color !== puzzle.to_play) newHistory.pop();
                return newHistory;
            });
            setTimeout(() => {
                setHasUsedHint(true);
            }, 50);
            return;
        }

        if (searchNode) {
            const targetCell = getHintCellFromNode(searchNode);
            if (targetCell) {
                setHintCell(targetCell);
                setHasUsedHint(true);
            } else {
                setHintCell(null);
            }
        }
    };


    const handleCellClick = (r: number, c: number) => {
        if (isProcessingMove || solveStatus !== 'playing' || boardState[r][c] !== null) return;
        if (currentPlayer !== puzzle.to_play) return;

        setHintCell(null);

        setIsProcessingMove(true);
        if (botMoveTimeoutRef.current) clearTimeout(botMoveTimeoutRef.current);

        setHistory(prev => [...prev, { row: r, col: c, color: currentPlayer }]);

        processingTimeoutRef.current = setTimeout(() => {
            setIsProcessingMove(false);
        }, 1500);
    };

    const handleRestart = () => {
        setHistory([]);
        setSolveStatus('playing');
        setCurrentPlayer(puzzle.to_play || 'B');
        setHintCell(null);
        setHasUsedHint(false);
        setIsProcessingMove(false);
        if (processingTimeoutRef.current) clearTimeout(processingTimeoutRef.current);
        if (botMoveTimeoutRef.current) clearTimeout(botMoveTimeoutRef.current);
        startTimeRef.current = Date.now();
    };

    const [isTransitioning, setIsTransitioning] = useState(false);
    const handleNextPuzzle = async () => {
        const difficulty = puzzle.difficulty_rank;
        const encodedType = encodeURIComponent(puzzle.collection_name || 'mix');
        setIsTransitioning(true);

        fetch(`http://89.167.122.76:8800/v1/tsumego/puzzles/next?user_rank=${difficulty || '15k'}&collection_name=${encodedType}`)
            .then(res => res.json())
            .then(data => {
                if (data && data.puzzle_id) {
                    router.push(`/tsumego/${data.puzzle_id}`).then(() => {
                        window.location.reload();
                    });
                } else {
                    router.push('/tsumego/mix').then(() => {
                        window.location.reload();
                    });
                }
            })
            .catch(err => {
                console.error("Failed to load next puzzle", err);
                setIsTransitioning(false);
                router.push('/tsumego/mix');
            });
    };

    return (
        <div className="w-full h-full flex flex-col items-center">
            {/* Status Overlays */}
            <div className={`mt-2 h-[80px] sm:h-[90px] w-full flex-shrink-0 flex items-center justify-between px-2 sm:px-4 relative z-40 transition-all duration-500`} style={{ maxWidth: boardPx }}>
                {/* Left controls: Restart & Hint */}
                <div className="flex gap-2 sm:gap-3 items-center">
                    <button
                        onClick={handleRestart}
                        className="p-3 sm:px-4 sm:py-2.5 rounded-full bg-[#1A1A1A] border border-white/5 hover:bg-white/5 transition-all outline-none flex items-center gap-2 group backdrop-blur-md shadow-lg"
                    >
                        <RotateCcw className="w-5 h-5 text-gray-400 group-hover:text-white transition-colors" />
                        <span className="hidden sm:inline font-bold text-gray-300">Restart</span>
                    </button>
                    {solveStatus === 'playing' && history.length < 5 && (
                        <button
                            onClick={handleHint}
                            className="p-3 sm:px-4 sm:py-2.5 rounded-full bg-[#1A1A1A] border border-white/5 hover:bg-white/5 transition-all outline-none flex items-center gap-2 group backdrop-blur-md shadow-lg"
                        >
                            <Lightbulb className="w-5 h-5 text-[#E9C46A]/80 group-hover:text-[#E9C46A] transition-colors" />
                            <span className="hidden sm:inline font-bold text-gray-300">Hint</span>
                        </button>
                    )}
                </div>

                <div className="flex-1 flex justify-center h-[56px] relative">
                    {/* Status Banners - Render absolutely within the flex container so they animate cleanly */}
                    {solveStatus === 'wrong' && (
                        <div className="absolute top-0 left-1/2 -translate-x-1/2 flex items-center gap-2 sm:gap-4 px-3 sm:px-5 py-2 sm:py-2.5 rounded-full shadow-2xl transition-all outline-none bg-red-500/10 border border-red-500/20 w-max z-50 animate-in fade-in slide-in-from-top-4">
                            <XCircle className="w-5 h-5 sm:w-6 sm:h-6 text-red-500 shrink-0" />
                            <span className="font-bold text-red-400 text-sm sm:text-[15px] whitespace-nowrap hidden sm:inline">Incorrect Move</span>
                            <div className="h-5 w-px bg-red-400/20 mx-1 hidden sm:block"></div>
                            <button
                                onClick={handleUndo}
                                className="flex items-center justify-center gap-2 px-3 py-1 bg-red-500 hover:bg-red-400 text-white rounded-full font-bold text-sm transition-colors shadow-lg shadow-red-500/20 whitespace-nowrap"
                            >
                                <Undo2 className="w-4 h-4 shrink-0" /> Undo
                            </button>
                        </div>
                    )}

                    {solveStatus === 'correct' && (
                        <div className="absolute top-0 left-1/2 -translate-x-1/2 flex items-center gap-2 sm:gap-4 px-3 sm:px-5 py-2 sm:py-2.5 rounded-full shadow-2xl transition-all outline-none bg-[#111111] border border-[#2A2A2A] w-max z-50 animate-in fade-in slide-in-from-top-4">
                            <div className="flex items-center gap-2 px-3 sm:px-5 py-1.5 sm:py-2.5 rounded-full bg-green-500/10 border border-green-500/20 text-green-500 font-medium whitespace-nowrap">
                                <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" /> <span className="text-sm sm:text-base">Solved</span>
                            </div>
                            {history.length > 0 && (
                                <button
                                    onClick={handleUndo}
                                    className="hidden sm:flex items-center gap-2 px-3 sm:px-4 py-1.5 sm:py-2 bg-[#1A1A1A] hover:bg-[#2A2A2A] text-white border border-white/10 rounded-full font-medium transition-colors shadow-lg whitespace-nowrap text-sm"
                                >
                                    <Undo2 className="w-4 h-4 shrink-0" /> Undo
                                </button>
                            )}
                            <button
                                onClick={handleNextPuzzle}
                                disabled={isTransitioning}
                                className="flex items-center gap-2 px-4 sm:px-6 py-1.5 sm:py-2.5 bg-[#E9C46A] hover:bg-[#d4b059] text-black rounded-full font-bold transition-colors shadow-lg shadow-[#E9C46A]/20 disabled:opacity-50 whitespace-nowrap text-sm sm:text-base"
                            >
                                {isTransitioning ? 'Loading...' : 'Next Puzzle'} <SkipForward className="w-4 h-4 shrink-0" />
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* Current Node Info */}
            {currentNode?.text && (
                <div className="bg-[#1A1A1A] border border-white/10 text-[#8B8B8B] px-5 py-2.5 rounded-full shadow-lg flex items-center gap-2 text-sm sm:max-w-xs truncate mb-4">
                    <Info className="w-4 h-4 text-[#E9C46A]" />
                    <span>{currentNode.text}</span>
                </div>
            )}

            {/* MAIN THEATER BOARD */}
            <div className="relative z-10 mx-auto mt-2 inline-block">
                <GoBoard
                    boardSize={size}
                    boardPx={boardPx}
                    displayBoard={boardState as any}
                    onIntersectionClick={handleCellClick}
                    hoverColor={currentPlayer === 'B' ? 'black' : 'white'}
                    lastMoveCoords={history.length > 0 ? { r: history[history.length - 1].row, c: history[history.length - 1].col } : null}
                    tsumegoHintCell={hintCell}
                    isGhostMode={isGhostMode}
                    initialBoardMap={initialBoardMap}
                />
            </div>
        </div>
    );
};

export default function TsumegoSolver() {
    const router = useRouter();
    const { id } = router.query;

    const [puzzle, setPuzzle] = useState<Puzzle | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [isGhostMode, setIsGhostMode] = useState(false);

    useEffect(() => {
        const saved = localStorage.getItem('tsumego_ghost_mode');
        if (saved) setIsGhostMode(saved === 'true');
    }, []);

    const toggleGhostMode = () => {
        const next = !isGhostMode;
        setIsGhostMode(next);
        localStorage.setItem('tsumego_ghost_mode', String(next));
    };

    useEffect(() => {
        if (!id) return;

        fetch(`http://89.167.122.76:8800/v1/tsumego/puzzles/${id}`)
            .then(res => res.json())
            .then(data => {
                if (data && data.id) {
                    setPuzzle(data);
                } else {
                    setError('Puzzle not found.');
                }
                setLoading(false);
            })
            .catch(err => {
                setError('Failed to load puzzle data.');
                setLoading(false);
            });
    }, [id]);

    if (loading) {
        return (
            <div className="min-h-screen bg-[#111111] flex flex-col items-center justify-center">
                <div className="w-10 h-10 border-4 border-white/10 border-t-[#E9C46A] rounded-full animate-spin mb-4"></div>
                <p className="text-[#8B8B8B] font-medium tracking-wide">Loading puzzle...</p>
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
                <div className="w-full xl:w-[320px] shrink-0 order-3 pt-4 relative z-40 transition-all duration-[800ms] ease-[cubic-bezier(0.4,0,0.2,1)] sticky top-28">
                    <div className="w-full bg-[#1A1A1A]/80 backdrop-blur-md rounded-[20px] shadow-[0_20px_50px_rgba(0,0,0,0.5)] border border-[#333] p-[20px] flex flex-col shrink-0 relative overflow-hidden group">
                        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#E9C46A] to-amber-500 opacity-80"></div>

                        <div>
                            <span className="inline-block px-3 py-1 bg-white/5 border border-white/10 text-white rounded-lg text-xs font-bold tracking-widest uppercase mb-4 mt-2">
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
                            <div className="flex justify-between items-center py-[4px] sm:py-[6px] text-[#A6AFBE] font-medium text-[13px] sm:text-[14px] border-b border-white/5">
                                <span>Board Size</span>
                                <span className="text-white font-bold text-[14px] sm:text-[15px] italic tracking-wide font-serif">{puzzle.board_width}x{puzzle.board_height}</span>
                            </div>
                            <div className="flex justify-between items-center text-[#8B8B8B]">
                                <span>To Play</span>
                                <span className="text-white flex items-center gap-2">
                                    <div className={`w-3 h-3 rounded-full ${puzzle.to_play === 'B' ? 'bg-black border border-white/20' : 'bg-white'}`}></div>
                                    {puzzle.to_play === 'B' ? 'Black' : 'White'}
                                </span>
                            </div>
                            <div className="w-full border-t border-[#333] pt-5 mt-5 flex justify-between items-center text-sm">
                                <span className="text-[#8B8B8B] font-semibold">Board Size</span>
                                <span className="text-white font-black">{puzzle.board_width}x{puzzle.board_width}</span>
                            </div>
                        </div>

                        {puzzle.tags && puzzle.tags.length > 0 && (
                            <>
                                <div className="h-px w-full bg-[#333] my-2"></div>
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
