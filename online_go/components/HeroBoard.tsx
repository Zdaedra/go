import React, { useState } from 'react';
import { motion, AnimatePresence, useMotionValue, useSpring, useTransform } from 'framer-motion';

// Copied from Katago Board Metrics Calculation for 9x9
const boardPx = 400; // Fixed size for the Hero Board
const fractionOffsetX = 0.239;
const fractionDistanceX = 0.514;
const fractionOffsetY = 0.199;
const fractionDistanceY = 0.525;
const boardSize = 9;

const paddingPxX = boardPx * fractionOffsetX;
const paddingPxY = boardPx * fractionOffsetY;
const gridInnerWidth = boardPx * fractionDistanceX;
const gridInnerHeight = boardPx * fractionDistanceY;

const visualGaps = Math.max(1, boardSize - 1);
const cellPxX = gridInnerWidth / visualGaps;
const cellPxY = gridInnerHeight / visualGaps;

export function HeroBoard({ onFirstMove, onBoardUpdate }: { onFirstMove?: () => void, onBoardUpdate?: (state: any) => void }) {
    const size = boardSize;
    const [board, setBoard] = useState<(string | null)[][]>(Array(size).fill(null).map(() => Array(size).fill(null)));
    const [currentPlayer, setCurrentPlayer] = useState('black');
    const [isThinking, setIsThinking] = useState(false);
    const [matchId, setMatchId] = useState<number | null>(null);

    const getLiberties = (checkBoard: any, row: number, col: number, color: string) => {
        const visited = new Set();
        let liberties = 0;
        const group: any[] = [];

        const dfs = (r: number, c: number) => {
            const key = `${r},${c}`;
            if (r < 0 || r >= size || c < 0 || c >= size || visited.has(key)) return;
            visited.add(key);

            if (checkBoard[r][c] === null) {
                liberties++;
            } else if (checkBoard[r][c] === color) {
                group.push([r, c]);
                dfs(r - 1, c);
                dfs(r + 1, c);
                dfs(r, c - 1);
                dfs(r, c + 1);
            }
        };

        dfs(row, col);
        return { liberties, group };
    };

    const checkCaptures = (checkBoard: any, color: string) => {
        let captured = 0;
        const newBoardState = checkBoard.map((row: any) => [...row]);

        for (let i = 0; i < size; i++) {
            for (let j = 0; j < size; j++) {
                if (newBoardState[i][j] === color) {
                    const { liberties, group } = getLiberties(newBoardState, i, j, color);
                    if (liberties === 0) {
                        group.forEach(([gr, gc]) => {
                            newBoardState[gr][gc] = null;
                        });
                        captured += group.length;
                    }
                }
            }
        }
        return { newBoardState, captured };
    };

    const xLabels = "ABCDEFGHJKLMNOPQRST";
    const toCoordinates = (r: number, c: number, boardSize: number) => {
        const x = xLabels[c];
        const y = boardSize - r;
        return `${x}${y}`;
    };

    const parseKataGoMove = (moveStr: string, boardSize: number) => {
        if (!moveStr || moveStr.toLowerCase() === 'pass' || moveStr.toLowerCase() === 'resign') return null;
        const cStr = moveStr.charAt(0).toUpperCase();
        const c = xLabels.indexOf(cStr);
        const y = parseInt(moveStr.slice(1), 10);
        const r = boardSize - y;
        if (c >= 0 && c < boardSize && r >= 0 && r < boardSize) return { r, c };
        return null;
    };

    const fetchBotMove = async (currentBoard: any, hr: number, hc: number) => {
        const blackStones: string[] = [];
        const whiteStones: string[] = [];
        let numMoves = 0;
        for (let i = 0; i < size; i++) {
            for (let j = 0; j < size; j++) {
                if (currentBoard[i][j] === 'black') { blackStones.push(toCoordinates(i, j, size)); numMoves++; }
                if (currentBoard[i][j] === 'white') { whiteStones.push(toCoordinates(i, j, size)); numMoves++; }
            }
        }

        const API_BASE_URL = typeof window !== 'undefined'
            ? `${window.location.protocol}//${window.location.hostname}:8800`
            : 'http://89.167.122.76:8800';

        const payload = {
            match_id: matchId,
            komi: 6.5,
            board_size: size,
            black_stones: blackStones,
            white_stones: whiteStones,
            to_play: "W",
            move_number: numMoves,
            bot_id: "sprout",
            last_played_move: toCoordinates(hr, hc, size)
        };

        try {
            const res = await fetch(`${API_BASE_URL}/v1/matches/bot/analyze`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const data = await res.json();
            if (data.status === 'success') {
                if (data.match_id) setMatchId(data.match_id);
                const actualResult = data.result?.result || data.result;
                const moveStr = actualResult?.best_move;
                if (moveStr) {
                    const parsed = parseKataGoMove(moveStr, size);
                    if (parsed) return parsed;
                }
            }
        } catch (e) {
            console.error("Katago fetch failed", e);
        }
        return null;
    };

    const handleMove = async (r: number, c: number) => {
        if (board[r][c] !== null || currentPlayer !== 'black' || isThinking) return;

        const tempBoard = board.map(row => [...row]);
        tempBoard[r][c] = 'black';

        const captureResult = checkCaptures(tempBoard, 'white');

        if (captureResult.captured === 0) {
            const { liberties } = getLiberties(captureResult.newBoardState, r, c, 'black');
            if (liberties === 0) return; // Suicide move
        }

        setBoard(captureResult.newBoardState);
        if (onFirstMove) onFirstMove();
        if (onBoardUpdate) onBoardUpdate(captureResult.newBoardState);
        setIsThinking(true);
        setCurrentPlayer('white');

        // Bot Move Integration
        const parsedMove = await fetchBotMove(captureResult.newBoardState, r, c);

        if (parsedMove) {
            setBoard(prev => {
                const tb = prev.map(row => [...row]);
                tb[parsedMove.r][parsedMove.c] = 'white';
                const cRes = checkCaptures(tb, 'black');
                if (onBoardUpdate) onBoardUpdate(cRes.newBoardState);
                return cRes.newBoardState;
            });
        }

        setIsThinking(false);
        setCurrentPlayer('black');
    };

    const paddingPx = 32;
    const heroCellPx = 38;

    const mouseX = useMotionValue(0.5);
    const mouseY = useMotionValue(0.5);

    const springConfig = { damping: 25, stiffness: 120 };
    const springX = useSpring(mouseX, springConfig);
    const springY = useSpring(mouseY, springConfig);

    const baseRotateX = 6;
    const baseRotateY = -6;

    // Physics bounds: How many degrees to pitch/yaw at the extreme edges
    const tiltX = 5.5;
    const tiltY = 6.5;

    // If springY = 0 (top edge), we want the top to dive (increase rotateX)
    // If springY = 1 (bottom), we want the bottom to dive (decrease rotateX)
    const rotateX = useTransform(springY, [0, 1], [baseRotateX + tiltX, baseRotateX - tiltX]);
    const rotateY = useTransform(springX, [0, 1], [baseRotateY - tiltY, baseRotateY + tiltY]);

    // Parallax shifting for floating UI elements like the "make a move" text
    const textX = useTransform(springX, [0, 1], [-16, 16]);
    const textY = useTransform(springY, [0, 1], [-16, 16]);

    const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const x = (e.clientX - rect.left) / rect.width;
        const y = (e.clientY - rect.top) / rect.height;
        mouseX.set(x);
        mouseY.set(y);
    };

    const handleMouseLeave = () => {
        mouseX.set(0.5);
        mouseY.set(0.5);
    };

    return (
        <div className="relative z-10 scale-[1.0] md:scale-[1.05] lg:scale-[1.25] xl:scale-[1.35] pointer-events-auto flex items-center justify-center transform-gpu" style={{ filter: "drop-shadow(0 40px 70px rgba(0,0,0,0.65)) drop-shadow(0 10px 25px rgba(0,0,0,0.25)) brightness(1.02) contrast(1.03)", perspective: "1200px" }}>
            {/* Added Board glow */}
            <div className="absolute inset-[-40px] z-[-1] pointer-events-none" style={{ background: "radial-gradient(circle, rgba(255,180,100,0.15), transparent 60%)", filter: "blur(40px)" }} />
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                whileHover={{ scale: 1.05 }}
                transition={{ duration: 1.2, ease: "easeOut" }}
                onMouseMove={handleMouseMove}
                onMouseLeave={handleMouseLeave}
                className="relative rounded-[18px] transform-gpu transition-shadow duration-300"
                style={{
                    background: 'linear-gradient(135deg, #F2C27A 0%, #D8A85A 40%, #C89448 80%, #9C6B2F 100%)',
                    boxShadow: '0 40px 120px rgba(0,0,0,0.5), 0 16px 40px rgba(0,0,0,0.3), inset 0 8px 20px rgba(255,255,255,0.25), inset 0 -30px 60px rgba(80,40,10,0.6), inset 0 2px 1px rgba(255,255,255,0.4), inset 0 -4px 12px rgba(0,0,0,0.4)',
                    rotateX,
                    rotateY,
                    rotateZ: -2,
                    padding: `${paddingPx}px`,
                    width: `${(size - 1) * heroCellPx + paddingPx * 2}px`,
                    height: `${(size - 1) * heroCellPx + paddingPx * 2}px`
                }}
            >
                {/* Wood Texture */}
                <div className="absolute inset-0 opacity-[0.20] pointer-events-none rounded-[18px]" style={{ backgroundImage: 'url("https://www.transparenttextures.com/patterns/retina-wood.png")', mixBlendMode: 'multiply' }}></div>

                {/* Volume Radial Gradient */}
                <div className="absolute inset-0 rounded-[18px] pointer-events-none mix-blend-soft-light" style={{ background: 'radial-gradient(circle at 40% 35%, rgba(255, 210, 140, 0.25), transparent 60%)' }} />

                {/* Hard Inlay Border connecting visuals to the actual game board */}
                <div className="absolute inset-[4px] rounded-[14px] border border-[#6b421a]/30 shadow-[inset_0_2px_4px_rgba(0,0,0,0.2),_0_1px_1px_rgba(255,255,255,0.3)] pointer-events-none" />
                <div className="absolute inset-[3px] rounded-[15px] border border-white/20 pointer-events-none" />

                <div
                    className="relative z-10"
                    style={{
                        display: 'grid',
                        gridTemplateColumns: `repeat(${size - 1}, ${heroCellPx}px)`,
                        gridTemplateRows: `repeat(${size - 1}, ${heroCellPx}px)`,
                        width: `${(size - 1) * heroCellPx}px`,
                        height: `${(size - 1) * heroCellPx}px`
                    }}
                >
                    {Array.from({ length: (size - 1) * (size - 1) }).map((_, i) => (
                        <div key={i} className="border-t border-l mix-blend-multiply" style={{ borderColor: 'rgba(100,50,0,0.18)', filter: 'drop-shadow(0 0.5px 0 rgba(255,255,255,0.12))' }} />
                    ))}

                    {/* Right and Bottom borders for the grid lines */}
                    <div className="absolute top-0 bottom-0 border-r mix-blend-multiply pointer-events-none" style={{ right: 0, borderColor: 'rgba(100,50,0,0.18)', filter: 'drop-shadow(0 0.5px 0 rgba(255,255,255,0.12))' }} />
                    <div className="absolute left-0 right-0 border-b mix-blend-multiply pointer-events-none" style={{ bottom: 0, borderColor: 'rgba(100,50,0,0.18)', filter: 'drop-shadow(0 0.5px 0 rgba(255,255,255,0.12))' }} />

                    {/* Hoshi */}
                    {[[2, 2], [2, 6], [6, 2], [6, 6], [4, 4]].map(([r, c], i) => (
                        <div
                            key={`hoshi-${i}`}
                            className="absolute rounded-full -translate-x-1/2 -translate-y-1/2 z-10 pointer-events-none mix-blend-multiply"
                            style={{ left: `${c * heroCellPx}px`, top: `${r * heroCellPx}px`, width: '6px', height: '6px', backgroundColor: 'rgba(70,40,10,0.6)' }}
                        />
                    ))}
                </div>

                {/* Tap Grid */}
                <div className="absolute inset-0 z-20 pointer-events-none w-full h-full" style={{ padding: `${paddingPx}px` }}>
                    <div
                        style={{
                            display: 'grid', gridTemplateColumns: `repeat(${size}, ${heroCellPx}px)`, gridTemplateRows: `repeat(${size}, ${heroCellPx}px)`,
                            width: `${size * heroCellPx}px`, height: `${size * heroCellPx}px`, marginLeft: `-${heroCellPx / 2}px`, marginTop: `-${heroCellPx / 2}px`
                        }}
                    >
                        {board.map((row, r) => row.map((stone, c) => (
                            <div
                                key={`cell-${r}-${c}`}
                                className="relative flex items-center justify-center cursor-pointer group z-10 pointer-events-auto"
                                style={{ width: heroCellPx, height: heroCellPx }}
                                onClick={() => handleMove(r, c)}
                            >
                                {stone === null && (
                                    <div className={`w-[85%] h-[85%] rounded-full opacity-0 group-hover:opacity-100 scale-50 group-hover:scale-100 transition-all duration-300 shadow-inner ${currentPlayer === 'black' ? 'bg-black/30' : 'bg-white/50'}`} />
                                )}
                                <AnimatePresence>
                                    {stone && (
                                        <motion.div
                                            initial={{ scale: 0, opacity: 0, y: -20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0, opacity: 0 }}
                                            transition={{ type: "spring", stiffness: 400, damping: 25 }}
                                            className="absolute w-[94%] h-[94%] rounded-full pointer-events-none"
                                            style={{
                                                background: stone === 'black' ? 'radial-gradient(circle at 30% 30%, #333, #000)' : 'radial-gradient(circle at 30% 30%, #fff, #ddd)',
                                                boxShadow: '0 4px 10px rgba(0,0,0,0.5)'
                                            }}
                                        />
                                    )}
                                </AnimatePresence>
                            </div>
                        )))}
                    </div>
                </div>

                {/* Tutorial Overlay */}
                <AnimatePresence>
                    {board.flat().every(cell => cell === null) && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0, scale: 0.98 }}
                            transition={{ duration: 1.2, delay: 0.5, ease: 'easeOut' }}
                            style={{ x: textX, y: textY }}
                            className="absolute bottom-6 right-6 pointer-events-none z-[100]"
                        >
                            <motion.span
                                animate={{ y: [0, -4, 0] }}
                                transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                                className="inline-block text-white/50 text-[10px] sm:text-[11px] font-extralight tracking-[0.3em] lowercase drop-shadow-md"
                            >
                                make a move
                            </motion.span>
                        </motion.div>
                    )}
                </AnimatePresence>
            </motion.div>
        </div>
    );
}

export default HeroBoard;
