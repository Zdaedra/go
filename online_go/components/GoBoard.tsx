import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export const toCoordinates = (r: number, c: number, boardSize: number) => {
    if (r === -1 || c === -1) return 'PASS';
    const xLabels = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T'];
    return `${xLabels[c]}${boardSize - r}`;
};

export const parseKataGoMove = (moveStr: string, currentBoardSize: number) => {
    if (!moveStr || moveStr.toUpperCase() === 'PASS' || moveStr.toUpperCase() === 'RESIGN') return null;
    const xLabels = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T'];
    const xIndex = xLabels.indexOf(moveStr[0].toUpperCase());
    const y = parseInt(moveStr.substring(1), 10);
    const r = currentBoardSize - y;
    const c = xIndex;
    return { r, c };
};

export interface GoBoardProps {
    boardSize: number;
    boardPx: number;
    displayBoard: (string | null)[][]; // Supports 'black', 'white', 'B', 'W'

    // Interactions
    onIntersectionClick?: (r: number, c: number) => void;
    hoverColor?: 'black' | 'white' | 'B' | 'W' | null;

    // Overlays
    lastMoveCoords?: { r: number, c: number } | null;

    // Territory Maps
    showTerritory?: boolean;
    currentOwnership?: number[]; // from katago

    // AI Sabaki Hints
    showHints?: boolean;
    hints?: Array<{ move: string, winrate?: number, scoreLead?: number }>;
    graphMode?: 'winrate' | 'score_lead';

    // Training / Mistake
    gameState?: 'playing' | 'finished' | 'mistake_training';
    expandedMistake?: any;
    reviewMistakes?: any[];
    currentMistakeIndex?: number;
    variationBranch?: any[];
    viewingMove?: number | null;

    // Tuition
    tuitionMode?: boolean;
    tuitionCandidates?: Array<{ r: number, c: number }>;

    // Tsumego
    tsumegoHintCell?: { r: number, c: number } | null;
    isGhostMode?: boolean;
    initialBoardMap?: boolean[][];
}

export const GoBoard: React.FC<GoBoardProps> = ({
    boardSize,
    boardPx,
    displayBoard,
    onIntersectionClick,
    hoverColor,
    lastMoveCoords,
    showTerritory,
    currentOwnership,
    showHints,
    hints = [],
    graphMode = 'winrate',
    gameState,
    expandedMistake,
    reviewMistakes = [],
    currentMistakeIndex = 0,
    variationBranch = [],
    viewingMove,
    tuitionMode,
    tuitionCandidates = [],
    tsumegoHintCell = null,
    isGhostMode = false,
    initialBoardMap = []
}) => {

    const woodUrl = '/assets/wood.png';
    const visualGaps = boardSize - 1;

    let fractionOffsetX, fractionDistanceX, fractionOffsetY, fractionDistanceY;

    if (boardSize === 9) {
        fractionOffsetX = 0.239;
        fractionDistanceX = 0.514;
        fractionOffsetY = 0.199;
        fractionDistanceY = 0.525;
    } else if (boardSize === 13) {
        fractionOffsetX = 0.141;
        fractionDistanceX = 0.658;
        fractionOffsetY = 0.117;
        fractionDistanceY = 0.647;
    } else {
        fractionOffsetX = 0.072;
        fractionDistanceX = 0.898;
        fractionOffsetY = 0.067;
        fractionDistanceY = 0.893;
    }

    const paddingPxX = boardPx * fractionOffsetX;
    const paddingPxY = boardPx * fractionOffsetY;
    const gridInnerWidth = boardPx * fractionDistanceX;
    const gridInnerHeight = boardPx * fractionDistanceY;

    const cellPxX = gridInnerWidth / visualGaps;
    const cellPxY = gridInnerHeight / visualGaps;

    const getHoshiPoints = () => {
        if (boardSize === 19) return [[3, 3], [3, 9], [3, 15], [9, 3], [9, 9], [9, 15], [15, 3], [15, 9], [15, 15]];
        if (boardSize === 13) return [[3, 3], [3, 9], [6, 6], [9, 3], [9, 9]];
        if (boardSize === 9) return [[2, 2], [2, 6], [4, 4], [6, 2], [6, 6]];
        return [];
    };

    const normalizeColor = (c: string | null) => {
        if (c === 'B' || c === 'black') return 'black';
        if (c === 'W' || c === 'white') return 'white';
        return null;
    };

    return (
        <div className="relative isolate shadow-[0_24px_50px_rgba(20,10,0,0.5),_0_0_80px_rgba(255,255,255,0.06)] overflow-hidden bg-[#2D1B10] group rounded-[6px] shrink-0"
            style={{ width: boardPx, height: boardPx }}>
            {/* Core Physical Board Texture mapped dynamically to cell count */}
            <div className="absolute inset-0 z-0 bg-cover bg-center pointer-events-none transition-all duration-[2500ms] shadow-[rgba(0,0,0,0.6)_0px_25px_50px_-12px,rgba(255,255,255,0.08)_0px_2px_4px_inset,rgba(0,0,0,0.4)_0px_-4px_8px_inset]"
                style={{ backgroundImage: `url('/board-${boardSize === 19 || boardSize === 13 || boardSize === 9 ? boardSize : 19}.png')` }} />

            <div className="absolute inset-0 z-0 pointer-events-none mix-blend-multiply opacity-[0.4] bg-gradient-to-br from-[#E2B785] via-[#C99863] to-[#7A512A]" />

            {/* Invisible Grid Container to Anchor Interactions perfectly over painted background */}
            <div className="absolute" style={{ left: paddingPxX, top: paddingPxY, width: `${(boardSize - 1) * cellPxX}px`, height: `${(boardSize - 1) * cellPxY}px` }} />

            {/* Interactive Intersections Map */}
            <div className="absolute inset-0 w-full h-full" style={{ paddingLeft: paddingPxX, paddingTop: paddingPxY, paddingRight: paddingPxX, paddingBottom: paddingPxY, zIndex: 100 }}>
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: `repeat(${boardSize}, ${cellPxX}px)`,
                    gridTemplateRows: `repeat(${boardSize}, ${cellPxY}px)`,
                    width: `${boardSize * cellPxX}px`, height: `${boardSize * cellPxY}px`,
                    marginLeft: `-${cellPxX / 2}px`, marginTop: `-${cellPxY / 2}px`
                }}>
                    {displayBoard.map((row, r) => row.map((rawStone, c) => {
                        const stone = normalizeColor(rawStone);
                        const isHoverColor = normalizeColor(hoverColor ?? null);

                        return (
                            <div
                                key={`${r}-${c}`}
                                className="relative flex items-center justify-center cursor-pointer group/cell"
                                style={{ width: cellPxX, height: cellPxY, zIndex: 50 }}
                                onClick={() => onIntersectionClick && onIntersectionClick(r, c)}
                            >
                                {/* Territory Overlay */}
                                {showTerritory && currentOwnership && (
                                    <div className="absolute inset-0 pointer-events-none rounded-[2px] z-20 transition-all duration-300" style={(() => {
                                        const idx = r * boardSize + c;
                                        const val = currentOwnership[idx];
                                        if (val === undefined || Math.abs(val) < 0.1) return { backgroundColor: 'transparent' };
                                        const isBlack = val > 0;
                                        const opacity = Math.min(Math.abs(val) * 0.75, 0.75);
                                        return {
                                            backgroundColor: isBlack ? `rgba(0, 0, 0, ${opacity})` : `rgba(255, 255, 255, ${opacity})`,
                                        };
                                    })()}>
                                        {stone === null && currentOwnership[r * boardSize + c] !== undefined && Math.abs(currentOwnership[r * boardSize + c]) >= 0.1 && (
                                            <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[25%] h-[25%] rounded-full ${currentOwnership[r * boardSize + c] > 0 ? 'bg-black/90' : 'bg-white/90 shadow'}`} />
                                        )}
                                    </div>
                                )}

                                {/* Hover Shadow */}
                                {stone === null && isHoverColor && !tuitionMode && onIntersectionClick && (
                                    <div className="w-[100%] h-[100%] scale-[0.9] group-hover/cell:scale-[1.15] opacity-0 group-hover/cell:opacity-60 transition-all duration-150 pointer-events-none z-30"
                                        style={{
                                            backgroundImage: isHoverColor === 'black' ? 'url(/assets/black_stone.png)' : 'url(/assets/white_stone.png)',
                                            backgroundSize: '100% 100%',
                                            backgroundPosition: 'center',
                                            backgroundRepeat: 'no-repeat',
                                            filter: 'drop-shadow(1px 3px 2px rgba(0,0,0,0.4))'
                                        }}
                                    />
                                )}

                                {/* Tuition Mode Candidate Stones */}
                                {stone === null && tuitionMode && tuitionCandidates.some(cd => cd.r === r && cd.c === c) && (
                                    <div className="absolute inset-0 flex items-center justify-center z-50 pointer-events-none">
                                        <motion.div
                                            initial={{ scale: 0, opacity: 0 }}
                                            animate={{ scale: 1.15, opacity: 1 }}
                                            className="w-[100%] h-[100%] rounded-full border-[3px] border-[#9C27B0] shadow-[0_0_8px_rgba(156,39,176,0.6),inset_0_0_8px_rgba(156,39,176,0.4)] flex items-start justify-end p-0">
                                            <div className="w-5 h-5 bg-[#9C27B0] rounded-full flex items-center justify-center text-white font-bold text-[10px] shadow-md transform translate-x-1.5 -translate-y-1.5">
                                                {tuitionCandidates.findIndex(cd => cd.r === r && cd.c === c) + 1}
                                            </div>
                                        </motion.div>
                                    </div>
                                )}

                                {/* Hint Overlay (Sabaki Variation format) */}
                                {stone === null && (showHints || expandedMistake !== null || gameState === 'mistake_training') && hints.find(h => h.move === toCoordinates(r, c, boardSize)) && (
                                    <div className="absolute inset-0 flex items-center justify-center z-40 pointer-events-none">
                                        {(() => {
                                            const hintInfo = hints.find(h => h.move === toCoordinates(r, c, boardSize));
                                            const hintIndex = hints.findIndex(h => h.move === toCoordinates(r, c, boardSize));
                                            const isBest = hintIndex === 0;
                                            const scoreVal = graphMode === 'winrate'
                                                ? `${Math.round((hintInfo?.winrate || 0) * 100)}%`
                                                : (hintInfo?.scoreLead !== undefined ? `${hintInfo.scoreLead > 0 ? '+' : ''}${hintInfo.scoreLead.toFixed(1)}` : '');
                                            return (
                                                <motion.div
                                                    initial={{ scale: 0, opacity: 0 }}
                                                    animate={{ scale: 1, opacity: 1 }}
                                                    transition={{ duration: 0.3, ease: "easeOut", delay: hintIndex * 0.05 }}
                                                    className={`rounded-full flex items-center justify-center font-bold text-white shadow-[0_2px_8px_rgba(0,0,0,0.2)] backdrop-blur-md
                                                    ${isBest
                                                            ? 'w-[75%] h-[75%] bg-[#4CAF84]/50 border border-[#4CAF84]/30 shadow-[inset_0_1px_4px_rgba(255,255,255,0.4)] scale-[1.15]'
                                                            : hintIndex > 3
                                                                ? 'w-[50%] h-[50%] bg-gray-500/20 border border-white/10 shadow-[inset_0_1px_2px_rgba(255,255,255,0.05)] text-white/70 scale-[1.15]'
                                                                : 'w-[65%] h-[65%] bg-gray-500/40 border border-white/20 shadow-[inset_0_1px_4px_rgba(255,255,255,0.2)] scale-[1.15]'}
                                                `}>
                                                    <div className={`${isBest ? 'text-[13px]' : hintIndex > 3 ? 'text-[9px]' : 'text-[11px]'} leading-none drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)] tracking-tight`}>{scoreVal}</div>
                                                </motion.div>
                                            )
                                        })()}
                                    </div>
                                )}

                                {/* Tsumego Hint Stone Overlay */}
                                {tsumegoHintCell && tsumegoHintCell.r === r && tsumegoHintCell.c === c && !stone && (
                                    <div className="absolute w-[80%] h-[80%] rounded-full animate-bounce z-20 flex items-center justify-center pointer-events-none">
                                        <div className="w-full h-full rounded-full bg-[#E9C46A]/90 shadow-[0_0_25px_rgba(233,196,106,1)] border-[3px] border-white flex items-center justify-center">
                                            <div className="w-[40%] h-[40%] rounded-full bg-white opacity-80 blur-[1px]"></div>
                                        </div>
                                    </div>
                                )}

                                {/* Mistake/Blunder Stone Overlay */}
                                {stone === null && gameState === 'finished' && typeof viewingMove === 'number' && reviewMistakes[currentMistakeIndex] && viewingMove === reviewMistakes[currentMistakeIndex].turn - 1 && variationBranch.length === 0 && (() => {
                                    const m = reviewMistakes[currentMistakeIndex];
                                    const parsed = parseKataGoMove(m.played_move, boardSize);
                                    if (parsed && parsed.r === r && parsed.c === c) {
                                        const isBlack = m.player === 'B';
                                        return (
                                            <div className="absolute inset-0 z-[45] pointer-events-none flex flex-col items-center justify-center scale-[1.15]"
                                                style={{
                                                    backgroundImage: isBlack ? 'url(/assets/black_stone.png)' : 'url(/assets/white_stone.png)',
                                                    backgroundSize: '100% 100%',
                                                    opacity: 0.65,
                                                    filter: 'drop-shadow(1px 2px 2px rgba(220,38,38,0.5))'
                                                }}>
                                                <div className="font-bold text-red-500 text-[14px] drop-shadow-[0_1px_1px_rgba(0,0,0,0.8)] leading-none mt-[-2px]">✕</div>
                                                <div className="font-bold text-red-500 text-[9px] drop-shadow-[0_1px_1px_rgba(0,0,0,0.8)] mt-0.5 whitespace-nowrap bg-black/60 px-1 rounded-sm">-{m.score_drop.toFixed(1)} pts</div>
                                            </div>
                                        )
                                    }
                                    return null;
                                })()}

                                {/* 3D Realistic Stones */}
                                <AnimatePresence>
                                    {stone && (
                                        <motion.div
                                            initial={{ scale: 0, opacity: 0 }}
                                            animate={{ scale: 1.15, opacity: isGhostMode && initialBoardMap && initialBoardMap[r] && !initialBoardMap[r][c] ? 0.7 : 1 }}
                                            exit={{ scale: 0, opacity: 0 }}
                                            transition={{ type: "spring", stiffness: 700, damping: 25 }}
                                            className="absolute w-[100%] h-[100%] flex items-center justify-center pointer-events-none"
                                            style={{
                                                backgroundImage: stone === 'black' ? 'url(/assets/black_stone.png)' : 'url(/assets/white_stone.png)',
                                                backgroundSize: '100% 100%',
                                                backgroundPosition: 'center',
                                                backgroundRepeat: 'no-repeat',
                                                filter: 'drop-shadow(1px 3px 2px rgba(0,0,0,0.4))'
                                            }}
                                        >
                                            {/* Last Move Overlaid Marker */}
                                            {lastMoveCoords && lastMoveCoords.r === r && lastMoveCoords.c === c && (
                                                <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[35%] h-[35%] rounded-full ${stone === 'black' ? 'border-[3px] border-white/80' : 'border-[3px] border-black/80'}`} />
                                            )}
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                        );
                    }))}
                </div>
            </div>
        </div>
    );
};
