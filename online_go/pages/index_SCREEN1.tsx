import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Play, BookOpen, MonitorPlay, ChevronRight, Activity, Users,
    Shield, Cpu, Target, Award, LineChart, MessageSquare, Menu, X
} from 'lucide-react';

// --- HERO BOARD COMPONENT ---
const HeroBoard = ({ onFirstMove, onBoardUpdate }) => {
    const size = 13;
    const [board, setBoard] = useState(Array(size).fill(null).map(() => Array(size).fill(null)));
    const [currentPlayer, setCurrentPlayer] = useState('black');
    const [isThinking, setIsThinking] = useState(false);

    const paddingPx = 30;

    const getLiberties = (checkBoard, row, col, color) => {
        const visited = new Set();
        let liberties = 0;
        const group = [];

        const dfs = (r, c) => {
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

    const checkCaptures = (checkBoard, color) => {
        let captured = 0;
        const newBoardState = checkBoard.map(row => [...row]);

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

    const handleMove = (r, c) => {
        if (board[r][c] !== null || currentPlayer !== 'black' || isThinking) return;

        const tempBoard = board.map(row => [...row]);
        tempBoard[r][c] = 'black';

        const captureResult = checkCaptures(tempBoard, 'white');

        if (captureResult.captured === 0) {
            const { liberties } = getLiberties(captureResult.newBoardState, r, c, 'black');
            if (liberties === 0) return;
        }

        setBoard(captureResult.newBoardState);
        onFirstMove();
        if (onBoardUpdate) onBoardUpdate(captureResult.newBoardState);
        setIsThinking(true);
        setCurrentPlayer('white');

        setTimeout(() => {
            setBoard(prev => {
                const botBoard = prev.map(row => [...row]);
                const validMoves = [];
                for (let i = 0; i < size; i++) {
                    for (let j = 0; j < size; j++) {
                        if (botBoard[i][j] === null) {
                            const tb = botBoard.map(row => [...row]);
                            tb[i][j] = 'white';
                            const cRes = checkCaptures(tb, 'black');

                            let isSuicide = false;
                            if (cRes.captured === 0) {
                                const { liberties } = getLiberties(cRes.newBoardState, i, j, 'white');
                                if (liberties === 0) isSuicide = true;
                            }

                            if (!isSuicide) {
                                let score = Math.random() * 10;
                                score += cRes.captured * 50;
                                if (i === 0 || i === size - 1 || j === 0 || j === size - 1) score -= 5;
                                const isHoshi = ([3, 9].includes(i) && [3, 9].includes(j)) || (i === 6 && j === 6);
                                if (isHoshi) score += 15;

                                let adjacentOp = 0;
                                [[-1, 0], [1, 0], [0, -1], [0, 1]].forEach(([dx, dy]) => {
                                    if (i + dx >= 0 && i + dx < size && j + dy >= 0 && j + dy < size) {
                                        if (botBoard[i + dx][j + dy] === 'black') adjacentOp++;
                                    }
                                });
                                score += adjacentOp * 5;

                                validMoves.push({ r: i, c: j, score, b: cRes.newBoardState });
                            }
                        }
                    }
                }

                if (validMoves.length > 0) {
                    validMoves.sort((a, b) => b.score - a.score);
                    const topN = Math.min(3, validMoves.length);
                    const chosen = validMoves[Math.floor(Math.random() * topN)];
                    setIsThinking(false);
                    setCurrentPlayer('black');
                    if (onBoardUpdate) onBoardUpdate(chosen.b);
                    return chosen.b;
                }

                setIsThinking(false);
                setCurrentPlayer('black');
                if (onBoardUpdate) onBoardUpdate(prev);
                return prev;
            });
        }, 600);
    };

    const heroCellPx = 32;

    return (
        <div
            className="relative bg-[#C28C53] border border-[#a2723c] rounded-2xl transform lg:rotate-2 lg:rotate-y-[15deg] lg:rotate-x-[20deg] transition-all duration-700 hover:rotate-0 hover:scale-[1.02]"
            style={{
                padding: `${paddingPx}px`,
                boxShadow: '0 24px 60px rgba(30,20,10,0.18), 0 8px 20px rgba(30,20,10,0.10)'
            }}
        >
            <div className="absolute inset-0 opacity-20 pointer-events-none mix-blend-overlay rounded-2xl" style={{ backgroundImage: 'url("https://www.transparenttextures.com/patterns/wood-pattern.png")' }}></div>
            <div className="absolute inset-0 rounded-2xl shadow-[inset_0_0_40px_rgba(0,0,0,0.3)] pointer-events-none border border-black/10" />

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
                    <div key={i} className="border-t border-l border-black/60" />
                ))}

                {/* Hoshi */}
                {[[3, 3], [3, 9], [6, 6], [9, 3], [9, 9]].map(([r, c], i) => (
                    <div
                        key={`hoshi-${i}`}
                        className="absolute bg-black/80 rounded-full -translate-x-1/2 -translate-y-1/2 z-10 pointer-events-none shadow-sm"
                        style={{ left: `${c * heroCellPx}px`, top: `${r * heroCellPx}px`, width: '8px', height: '8px' }}
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
                                <div className={`w-[80%] h-[80%] rounded-full opacity-0 group-hover:opacity-100 scale-50 group-hover:scale-100 transition-all duration-300 shadow-inner ${currentPlayer === 'black' ? 'bg-black/20' : 'bg-white/40'}`} />
                            )}
                            <AnimatePresence>
                                {stone && (
                                    <motion.div
                                        initial={{ scale: 0, opacity: 0, y: -20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0, opacity: 0 }}
                                        transition={{ type: "spring", stiffness: 400, damping: 25 }}
                                        className={`absolute w-[94%] h-[94%] rounded-full shadow-2xl pointer-events-none ${stone === 'black' ? 'bg-gradient-to-br from-gray-700 to-black border-none' : 'bg-gradient-to-br from-white to-gray-200 border border-black/5'}`}
                                        style={{ boxShadow: stone === 'black' ? '2px 6px 10px rgba(0,0,0,0.8), inset -2px -4px 6px rgba(255,255,255,0.15)' : '2px 6px 10px rgba(0,0,0,0.5), inset -2px -4px 6px rgba(0,0,0,0.1)' }}
                                    />
                                )}
                            </AnimatePresence>
                        </div>
                    )))}
                </div>
            </div>
        </div>
    );
};

// --- BENTO GRID CARD ---
const BentoCard = ({ icon: CustomIcon, title, desc, className, bgImage, href }: any) => {
    const cardContent = (
        <div className={`cursor-pointer w-full h-full relative p-0 rounded-[20px] backdrop-blur-[16px] bg-[rgba(255,255,255,0.65)] border border-[rgba(120,100,80,0.10)] overflow-hidden group hover:-translate-y-1 transition-all duration-500 shadow-[0_14px_32px_rgba(30,20,10,0.10),_inset_0_1px_0_rgba(255,255,255,0.65)] hover:shadow-[0_20px_48px_rgba(30,20,10,0.16),_inset_0_1px_0_rgba(255,255,255,0.65)] ${className}`}
            style={{ boxShadow: '0 10px 24px rgba(30,20,10,0.08)' }}>

            {/* Background Image placed right */}
            {bgImage && (
                <div
                    className="absolute inset-0 bg-no-repeat opacity-90 group-hover:scale-[1.03] transition-transform duration-700 saturate-[0.95] contrast-[0.95]"
                    style={{
                        backgroundImage: `url(${bgImage})`,
                        backgroundPosition: 'right bottom',
                        backgroundSize: 'contain',
                        maskImage: 'linear-gradient(to right, transparent, black 50%, black 100%)',
                        WebkitMaskImage: 'linear-gradient(to right, transparent, black 50%, black 100%)'
                    }}
                />
            )}

            {/* Content */}
            <div className="relative z-10 p-[26px] h-full flex flex-col justify-start w-[65%]">
                <div className="flex items-center gap-3 mb-2 pt-1">
                    {CustomIcon && <CustomIcon />}
                    <h3 className="text-[20px] font-bold text-[#1E1C19] tracking-tight pb-[2px]">{title}</h3>
                </div>
                <p className="text-[#6E675F] text-[13.5px] font-medium leading-[1.4] drop-shadow-sm">{desc}</p>
            </div>
        </div>
    );

    return href ? <Link href={href} className="w-full h-full block">{cardContent}</Link> : cardContent;
};

// --- MAIN PAGE ---
export default function Home() {
    const router = useRouter();
    const [scrolled, setScrolled] = useState(false);
    const [hasInteracted, setHasInteracted] = useState(false);
    const [heroBoardData, setHeroBoardData] = useState(null);

    const handleContinueGame = () => {
        if (heroBoardData) {
            sessionStorage.setItem('heroBoardState', JSON.stringify(heroBoardData));
        }
        router.push('/play/katago?auto=true&continue=hero');
    };

    useEffect(() => {

        const handleScroll = () => {
            if (window.scrollY > 0) {
                setScrolled(true);
            } else {
                setScrolled(false);
            }
        };

        window.addEventListener('scroll', handleScroll);
        return () => {
            window.removeEventListener('scroll', handleScroll);
        };
    }, []);

    return (
        <div className="min-h-screen text-[#EDE7E0] selection:bg-[#d9a35f]/30 font-sans overflow-x-hidden"
            style={{ background: "radial-gradient(circle at 30% 20%, rgba(255,210,150,0.18), transparent 40%), radial-gradient(circle at 70% 10%, rgba(255,235,210,0.10), transparent 50%), linear-gradient(180deg, #2a2723, #1c1a18)" }}>
            <Head>
                <title>KAI | Master the Game of Go</title>
                <meta name="description" content="Play online, analyze with AI, improve every day." />
            </Head>

            <main className="pt-24 pb-12">
                {/* HERO SECTION */}
                <section className="relative w-full max-w-[1400px] mx-auto min-h-[60vh] flex flex-col md:flex-row items-center justify-center mb-12 px-4 overflow-hidden pt-20">

                    {/* The Board is the dominant center object */}
                    <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 1.2, ease: "easeOut" }} className="absolute z-10 scale-[1.1] md:scale-[1.25] lg:scale-[1.4] right-[-15%] md:right-[5%] lg:right-[15%] pointer-events-auto border border-black/10 rounded-[6px] shadow-[0_40px_80px_rgba(0,0,0,0.45),_0_12px_30px_rgba(0,0,0,0.25)] rotate-[3deg]">
                        <div className="relative w-full h-full flex items-center justify-center">
                            <div className="absolute -inset-[40px] bg-[radial-gradient(circle,rgba(255,200,140,0.15),transparent_60%)] blur-[40px] -z-10 pointer-events-none" />
                            <HeroBoard
                                onFirstMove={() => setHasInteracted(true)}
                                onBoardUpdate={(state) => setHeroBoardData(state)}
                            />
                        </div>
                    </motion.div>

                    {/* The Floating UI Panel */}
                    <motion.div initial={{ opacity: 0, x: -40 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 1, delay: 0.3 }}
                        className="relative z-20 w-[94%] max-w-[440px] mr-auto mt-[40vh] md:mt-0 md:ml-12 lg:ml-[15%] p-8 md:p-10 flex flex-col gap-6"
                        style={{
                            background: "radial-gradient(circle at 25% 20%, rgba(255,210,150,0.25), transparent 45%), radial-gradient(circle at 70% 15%, rgba(255,235,210,0.12), transparent 50%), linear-gradient(180deg, rgba(255,255,255,0.14), rgba(255,255,255,0.08))",
                            backdropFilter: "blur(20px)",
                            border: "1px solid rgba(255,255,255,0.18)",
                            boxShadow: "0 30px 80px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.25)",
                            borderRadius: "24px"
                        }}>

                        <div>
                            <h1 className="text-[36px] md:text-[44px] font-bold tracking-tight text-[#EDE7E0] leading-[1.1] mb-3">
                                Play
                            </h1>
                            <p className="text-[16px] text-[rgba(255,255,255,0.65)] leading-relaxed">
                                Play online. Train with KataGo.
                            </p>
                        </div>

                        <div className="flex flex-col gap-4 mt-2">
                            {hasInteracted ? (
                                <button
                                    onClick={handleContinueGame}
                                    className="group relative w-full py-[16px] rounded-[16px] font-bold transition-all flex items-center justify-center gap-3 bg-[linear-gradient(180deg,#1a1a1a,#0f0f0f)] text-[rgba(255,255,255,0.94)] hover:-translate-y-[2px] shadow-[0_12px_28px_rgba(0,0,0,0.45),_inset_0_1px_0_rgba(255,255,255,0.08)] hover:shadow-[0_16px_36px_rgba(0,0,0,0.55),_inset_0_1px_0_rgba(255,255,255,0.15)] text-[16px] tracking-wide"
                                >
                                    <Play className="w-[18px] h-[18px] fill-current" />
                                    Continue Game
                                </button>
                            ) : (
                                <Link
                                    href="/play/online"
                                    className="group relative w-full py-[16px] rounded-[16px] font-bold transition-all flex items-center justify-center gap-3 bg-[linear-gradient(180deg,#1a1a1a,#0f0f0f)] text-[rgba(255,255,255,0.94)] shadow-[0_12px_28px_rgba(0,0,0,0.45),_inset_0_1px_0_rgba(255,255,255,0.08)] hover:-translate-y-1 hover:shadow-[0_16px_36px_rgba(0,0,0,0.55),_inset_0_1px_0_rgba(255,255,255,0.15)] text-[16px] tracking-wide"
                                >
                                    <Play className="w-[18px] h-[18px] fill-current" />
                                    Start a Game
                                </Link>
                            )}
                            <Link href="/watch" className="w-full py-[16px] rounded-[16px] font-bold flex flex-row items-center justify-center text-center transition-all duration-300 text-[15px] text-[#EDE7E0] bg-[rgba(255,255,255,0.12)] border border-[rgba(255,255,255,0.25)] shadow-[inset_0_1px_0_rgba(255,255,255,0.3)] hover:bg-[rgba(255,255,255,0.18)] hover:-translate-y-[2px]">
                                Analyze Game
                            </Link>
                        </div>
                    </motion.div>
                </section>

                {/* FEATURE BENTO GRID */}
                <section className="max-w-[1100px] mx-auto px-6 mb-32">
                    <div className="grid md:grid-cols-2 lg:grid-cols-2 gap-6 auto-rows-[160px]">
                        <BentoCard
                            icon={() => (
                                <div className="relative w-6 h-6 shrink-0">
                                    <div className="absolute top-0 right-0.5 w-[15px] h-[15px] rounded-full bg-black shadow-md border border-[#333]"></div>
                                    <div className="absolute bottom-0 left-0.5 w-[19px] h-[19px] rounded-full bg-[#f0f0f0] shadow-md border border-gray-300"></div>
                                </div>
                            )}
                            title="Play vs People"
                            desc="Find a game in seconds with precision matchmaking."
                            bgImage="/img/bento_quick_match.png"
                            href="/play/online"
                        />
                        <BentoCard
                            icon={() => (
                                <div className="relative w-6 h-6 shrink-0 flex items-center justify-center">
                                    <div className="relative w-[22px] h-[22px] rounded-full bg-gradient-to-br from-[#1C1F26] to-black shadow-lg border border-gray-700">
                                        <div className="absolute top-[3px] right-[3px] w-2 h-2 rounded-full bg-[#d9a35f] shadow-[0_0_6px_#d9a35f]"></div>
                                    </div>
                                </div>
                            )}
                            title="Play vs AI"
                            desc="Challenge KataGo directly in your browser."
                            bgImage="/img/bento_play_ai.png"
                            href="/play/katago"
                        />
                        <BentoCard
                            icon={() => (
                                <div className="relative w-7 h-7 shrink-0 -ml-1">
                                    <div className="absolute top-1 left-0 w-[14px] h-[14px] rounded-full bg-black shadow-md border border-gray-800 z-10"></div>
                                    <div className="absolute bottom-0 right-1 w-[15px] h-[15px] rounded-full bg-black shadow-md border border-gray-800 z-0"></div>
                                    <div className="absolute bottom-1 left-1.5 w-[16px] h-[16px] rounded-full bg-white shadow-xl border border-gray-300 z-20"></div>
                                </div>
                            )}
                            title="Watch Live Games"
                            desc="Top players in action."
                            bgImage="/img/bento_live_games.png"
                            href="/watch"
                        />
                        <BentoCard
                            icon={() => (
                                <div className="relative flex items-end justify-center w-6 h-6 shrink-0 gap-[3px] pb-1">
                                    <div className="w-[3.5px] h-[10px] bg-[#d9a35f] rounded-[1px] shadow-[0_0_5px_#d9a35f]"></div>
                                    <div className="w-[3.5px] h-[16px] bg-[#d9a35f] rounded-[1px] shadow-[0_0_5px_#d9a35f]"></div>
                                    <div className="w-[3.5px] h-[8px] bg-[#d9a35f] rounded-[1px] shadow-[0_0_5px_#d9a35f]"></div>
                                    <div className="w-[3.5px] h-[20px] bg-[#d9a35f] rounded-[1px] shadow-[0_0_5px_#d9a35f]"></div>
                                </div>
                            )}
                            title="AI Game Review"
                            desc="Analyze your games with instant AI suggestions."
                            bgImage="/img/bento_ai_review.png"
                            href="/analysis"
                        />
                        <BentoCard
                            icon={() => (
                                <div className="flex bg-[#eab775] w-[22px] h-[22px] rounded-[5px] p-[2px] grid grid-cols-2 gap-[1px] shadow-[inset_0_1px_3px_rgba(0,0,0,0.6)] border border-gray-400 mt-[2px] ml-1 mr-1">
                                    <div className="w-[7px] h-[7px] justify-self-center self-center rounded-full bg-black shadow-md"></div>
                                    <div className="w-[7px] h-[7px] justify-self-center self-center rounded-full bg-white shadow-md border border-gray-200"></div>
                                    <div className="w-[7px] h-[7px] justify-self-center self-center rounded-full"></div>
                                    <div className="w-[7px] h-[7px] justify-self-center self-center rounded-full bg-white shadow-md border border-gray-200"></div>
                                </div>
                            )}
                            title="Tsumego Puzzles"
                            desc="Daily Go challenges to keep reading sharp."
                            bgImage="/img/bento_tsumego.png"
                            href="/tsumego"
                        />
                        <BentoCard
                            icon={() => (
                                <div className="flex bg-[#684123] w-[22px] h-[22px] rounded-sm shadow-md relative border border-[#302011] overflow-hidden mt-[2px] ml-1 mr-1">
                                    <div className="w-[2px] h-full bg-black/50 absolute left-[3px] z-10"></div>
                                    <div className="w-full h-full bg-gradient-to-r from-transparent to-black/30 z-0"></div>
                                    <div className="absolute top-[3px] right-[2px] w-[14px] h-[10px] bg-[#f5d998] flex items-center justify-center text-[5px] font-bold text-[#302011] border border-black/40 rounded-[1px] leading-[0]">GO</div>
                                </div>
                            )}
                            title="Learn Go"
                            desc="Lessons & Tutorials"
                            bgImage="/img/bento_learn_go.png"
                            href="/learn"
                        />

                    </div>
                </section>

                {/* LIVE GAMES SECTION */}
                <section className="max-w-[1100px] mx-auto px-6 mb-32">
                    <div className="flex items-center justify-center mb-10">
                        <h2 className="text-[28px] font-bold flex items-center gap-3 text-[#1E1C19] tracking-tight"><MonitorPlay className="text-[#47a479]" /> Live Matches</h2>
                    </div>
                    <div className="rounded-[28px] bg-[linear-gradient(180deg,rgba(255,255,255,0.78),rgba(244,240,236,0.92))] backdrop-blur-[16px] overflow-hidden relative shadow-[0_14px_32px_rgba(30,20,10,0.10),_inset_0_1px_0_rgba(255,255,255,0.65)] hover:shadow-[0_20px_48px_rgba(30,20,10,0.16),_inset_0_1px_0_rgba(255,255,255,0.65)] border border-white/35">
                        {/* Decorative inset shadow */}
                        <div className="absolute inset-0 pointer-events-none" />
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="border-b border-[rgba(80,60,40,0.08)] text-[#948C83] text-[11px] font-bold tracking-[0.08em] uppercase tracking-wider">
                                        <th className="p-6 font-medium">Players</th>
                                        <th className="p-6 font-medium">Board</th>
                                        <th className="p-6 font-medium">Status</th>
                                        <th className="p-6 font-medium text-right">Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {[
                                        { p1: "AlphaMaster [9d]", p2: "ZenGo [8d]", size: "19x19", move: 184 },
                                        { p1: "StrayCat [3k]", p2: "Kitsune [4k]", size: "13x13", move: 52 },
                                        { p1: "Novice88 [12k]", p2: "GoLearner [11k]", size: "19x19", move: 12 },
                                    ].map((game, i) => (
                                        <tr key={i} className="border-b last:border-0 border-[rgba(80,60,40,0.05)] hover:bg-[rgba(255,255,255,0.5)] transition-colors">
                                            <td className="p-6 font-semibold flex items-center gap-3">
                                                <div className="flex flex-col gap-2">
                                                    <span className="flex items-center gap-2 text-[#3A342E]"><div className="w-3 h-3 bg-black rounded-full shadow-sm" /> {game.p1}</span>
                                                    <span className="flex items-center gap-2 text-[#3A342E]"><div className="w-3 h-3 bg-white border border-gray-300 rounded-full shadow-sm" /> {game.p2}</span>
                                                </div>
                                            </td>
                                            <td className="p-6 text-[#6E675F] font-medium">{game.size}</td>
                                            <td className="p-6 text-[#6E675F] font-medium">Move {game.move}</td>
                                            <td className="p-6 text-right">
                                                <button className="px-5 py-2 rounded-lg bg-[linear-gradient(180deg,rgba(255,255,255,0.72),rgba(248,244,240,0.88))] hover:-translate-y-[2px] hover:shadow-[0_8px_20px_rgba(30,20,10,0.1),_inset_0_1px_0_rgba(255,255,255,0.8)] text-[#6E675F] text-[10px] font-bold tracking-widest uppercase transition-all duration-300 border border-[rgba(80,60,40,0.08)] shadow-[0_6px_16px_rgba(30,20,10,0.06),_inset_0_1px_0_rgba(255,255,255,0.7)]">Watch</button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </section>

                {/* RANKING & YOUR RANK */}
                <section className="max-w-[1100px] mx-auto px-6 mb-32 grid lg:grid-cols-2 gap-6">
                    <div className="rounded-[28px] bg-[linear-gradient(180deg,rgba(255,255,255,0.78),rgba(244,240,236,0.92))] backdrop-blur-[16px] border border-white/35 p-8 hover:-translate-y-1 transition-transform duration-500 shadow-[0_14px_32px_rgba(30,20,10,0.10),_inset_0_1px_0_rgba(255,255,255,0.65)] hover:shadow-[0_20px_48px_rgba(30,20,10,0.16),_inset_0_1px_0_rgba(255,255,255,0.65)] relative isolation-auto">
                        <h2 className="text-[22px] font-bold mb-6 text-[#3A342E] pb-4 border-b border-gray-100 tracking-tight">Top Players</h2>
                        <div className="space-y-3">
                            {[{ name: "LeeBot", rank: "9d" }, { name: "Takumi", rank: "8d" }, { name: "Atlas", rank: "8d" }].map((p, i) => (
                                <div key={i} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                                    <div className="flex items-center gap-4">
                                        <span className="font-mono text-[#6E675F] font-bold text-sm">#{i + 1}</span>
                                        <span className="font-bold text-[#3A342E]">{p.name}</span>
                                    </div>
                                    <span className="text-[#d9a35f] font-bold text-sm">{p.rank}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="rounded-[28px] bg-[linear-gradient(180deg,rgba(255,255,255,0.78),rgba(244,240,236,0.92))] backdrop-blur-[16px] overflow-hidden relative shadow-[0_14px_32px_rgba(30,20,10,0.10),_inset_0_1px_0_rgba(255,255,255,0.65)] hover:shadow-[0_20px_48px_rgba(30,20,10,0.16),_inset_0_1px_0_rgba(255,255,255,0.65)] border border-white/35 p-8 flex flex-col items-center justify-center text-center relative overflow-hidden group hover:-translate-y-1 transition-transform duration-500">
                        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-white/10 via-transparent to-transparent pointer-events-none transition-colors duration-500" />
                        <h3 className="text-[12px] font-bold text-[#d9a35f]/90 tracking-widest uppercase mb-2 z-10">Your Rank</h3>
                        <div className="text-[100px] leading-none font-black text-white drop-shadow-sm mb-4 z-10 tracking-tighter">3k</div>
                        <p className="text-[#948C83] text-[14px] tracking-wide z-10 max-w-[80%]">Keep playing! You are 4 wins away from 2k.</p>
                        <button className="mt-8 px-8 py-3 bg-[linear-gradient(180deg,rgba(255,255,255,0.72),rgba(248,244,240,0.88))] backdrop-blur-md text-[#3A342E] shadow-[0_6px_16px_rgba(0,0,0,0.4),_inset_0_1px_0_rgba(255,255,255,0.7)] border border-[rgba(80,60,40,0.08)] hover:-translate-y-1 hover:shadow-[0_10px_24px_rgba(0,0,0,0.6),_inset_0_1px_0_rgba(255,255,255,0.8)] rounded-full font-bold transition-all z-10 text-[13px] uppercase tracking-widest tracking-wide shadow-xl">View Stats</button>
                    </div>
                </section>

                {/* AI ANALYSIS DEMO */}
                <section className="max-w-[1100px] mx-auto px-6 mb-32">
                    <div className="rounded-[28px] bg-[linear-gradient(180deg,rgba(255,255,255,0.78),rgba(244,240,236,0.92))] backdrop-blur-[16px] overflow-hidden grid lg:grid-cols-2 group hover:-translate-y-1 transition-transform duration-500 shadow-[0_14px_32px_rgba(30,20,10,0.10),_inset_0_1px_0_rgba(255,255,255,0.65)] hover:shadow-[0_20px_48px_rgba(30,20,10,0.16),_inset_0_1px_0_rgba(255,255,255,0.65)] border border-white/35 relative">
                        <div className="absolute inset-0 bg-gradient-to-r from-emerald-50/50 to-transparent pointer-events-none" />
                        <div className="p-12 lg:p-14 flex flex-col justify-center relative z-10">
                            <h2 className="text-[36px] font-black mb-6 tracking-tight text-[#3A342E] leading-[1.1]">AI Game Review</h2>
                            <p className="text-[#6E675F] mb-10 leading-[1.6] text-[15px] max-w-[90%]">
                                Understand your mistakes immediately. Our visual analysis tool charts winrates, explores variations, and points you exactly to where the game turned.
                            </p>
                            <button className="px-8 py-4 bg-[linear-gradient(180deg,#1a1a1a,#0f0f0f)] text-[rgba(255,255,255,0.94)] border border-white/5 font-bold rounded-full transition-all w-max hover:-translate-y-1 shadow-[0_12px_30px_rgba(0,0,0,0.35),_inset_0_1px_0_rgba(255,255,255,0.08)] hover:shadow-[0_15px_35px_rgba(0,0,0,0.4),_inset_0_1px_0_rgba(255,255,255,0.15)] text-[14px] tracking-wide">
                                Analyze Your Game
                            </button>
                        </div>
                        <div className="relative flex items-center justify-center p-8 border-l border-gray-100 bg-[rgba(255,255,255,0.2)] overflow-hidden min-h-[400px] border-l border-white/40">
                            {/* Mock of Analysis Graph & Board overlay */}
                            <div className="absolute top-12 left-10 right-10 h-40 bg-gradient-to-b from-emerald-100/50 to-transparent rounded-xl border-t border-emerald-200 flex items-end overflow-hidden">
                                <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                                    <path d="M0,80 L20,75 L40,85 L45,40 L60,45 L80,30 L100,20 L100,100 L0,100 Z" fill="rgba(71, 164, 121, 0.1)" />
                                    <path d="M0,80 L20,75 L40,85 L45,40 L60,45 L80,30 L100,20" fill="none" stroke="#47a479" strokeWidth="2.5" />
                                </svg>
                            </div>
                            <div className="mt-24 w-56 h-56 bg-[#e0b583] border border-[#d2a36b] rounded-md shadow-2xl relative grid grid-cols-3 grid-rows-3 p-4 gap-0 transform rotate-3 hover:rotate-0 transition-transform duration-500">
                                <div className="absolute inset-0 opacity-40 pointer-events-none mix-blend-overlay" style={{ backgroundImage: 'url("https://www.transparenttextures.com/patterns/wood-pattern.png")' }}></div>
                                {Array.from({ length: 9 }).map((_, i) => <div key={i} className="border-t border-l border-black/30" />)}
                                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 bg-black rounded-full shadow-[0_5px_10px_rgba(0,0,0,0.5),_inset_-2px_-4px_6px_rgba(255,255,255,0.15)] flex items-center justify-center z-10">
                                    <div className="w-2.5 h-2.5 bg-[#47a479] rounded-full shadow-[0_0_8px_#47a479]" />
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                {/* COMMUNITY */}
                <section className="max-w-[1100px] mx-auto px-6 mb-24">
                    <h2 className="text-[28px] font-bold mb-8 text-center text-[#1E1C19] tracking-tight">Community</h2>
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
                        {[
                            { title: 'Clubs', icon: Users, color: 'text-[#47a479]' },
                            { title: 'Chat Rooms', icon: MessageSquare, color: 'text-blue-500' },
                            { title: 'Study Groups', icon: BookOpen, color: 'text-purple-500' },
                            { title: 'Tournaments', icon: Award, color: 'text-yellow-500' }
                        ].map((item, i) => (
                            <Link key={i} href="/community" className={`flex flex-col items-center justify-center p-8 rounded-[28px] bg-[linear-gradient(180deg,rgba(255,255,255,0.55),rgba(244,240,236,0.65))] border border-white/40 hover:-translate-y-1 transition-all duration-300 group shadow-[inset_0_1px_0_rgba(255,255,255,0.6),_0_8px_20px_rgba(30,20,10,0.05)] hover:shadow-[0_15px_40px_rgba(25,18,12,0.1),_inset_0_1px_0_rgba(255,255,255,0.8)]`}>
                                <item.icon className={`w-10 h-10 mb-4 drop-shadow-sm scale-100 group-hover:scale-110 group-hover:-translate-y-1 transition-transform duration-300 ${item.color}`} />
                                <span className="font-bold text-[#3A342E] text-[15px]">{item.title}</span>
                            </Link>
                        ))}
                    </div>
                </section>

            </main>

            {/* FOOTER */}
            <footer className="border-t border-white/5 bg-[#0A0A0A] py-12">
                <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-6">
                    <div className="flex items-center gap-2">
                        <img src="/img/kai_logo.png" className="h-8 object-contain opacity-90 mix-blend-multiply" alt="KAI" />
                    </div>
                    <div className="flex flex-wrap items-center justify-center gap-6 text-sm font-medium text-[#6E675F]">
                        <Link href="/about" className="hover:text-white transition-colors">About</Link>
                        <Link href="/rules" className="hover:text-white transition-colors">Rules</Link>
                        <Link href="/privacy" className="hover:text-white transition-colors">Privacy</Link>
                        <Link href="/api" className="hover:text-white transition-colors">API</Link>
                        <Link href="/github" className="hover:text-white transition-colors">Github</Link>
                    </div>
                    <div className="text-gray-600 text-sm">
                        © 2026 KAI Platform
                    </div>
                </div>
            </footer>
        </div>
    );
}
