import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { ChevronLeft, Check, Clock, Zap, Target, Search, XCircle, RotateCcw, Play } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

type MatchState = 'settings' | 'waiting' | 'found' | 'live' | 'result';


export default function OnlinePlay() {
    const router = useRouter();

    // State machine
    const [gameState, setGameState] = useState<MatchState>('settings');

    useEffect(() => {
        if (router.isReady && router.query.auto === 'true' && gameState === 'settings') {
            setGameState('waiting');
            const { auto, ...restQuery } = router.query;
            router.replace({ pathname: router.pathname, query: restQuery }, undefined, { shallow: true });
        }
    }, [router.isReady, router.query, gameState]);

    // Match Settings
    const [boardSizes, setBoardSizes] = useState<number[]>([9, 13, 19]);
    const [ruleset, setRuleset] = useState<'japanese' | 'chinese'>('japanese');
    const [strength, setStrength] = useState<'easier' | 'around' | 'stronger'>('around');
    const [timePreset, setTimePreset] = useState<'blitz' | 'rapid' | 'standard' | 'correspondence'>('rapid');

    // Correspondence Settings
    const [daysPerMove, setDaysPerMove] = useState(3);
    const [pauseOnWeekends, setPauseOnWeekends] = useState(true);

    const [isRanked, setIsRanked] = useState(true);

    // More Options
    const [showMoreOptions, setShowMoreOptions] = useState(false);
    const [handicap, setHandicap] = useState<'auto' | 'none'>('auto');

    // UI feedback
    const [shakeBoardSize, setShakeBoardSize] = useState(false);

    // Waiting State
    const [waitTime, setWaitTime] = useState(0);
    const [showLongWaitHints, setShowLongWaitHints] = useState(false);

    // Real matching effect via WebSockets
    const [socket, setSocket] = useState<WebSocket | null>(null);
    const isIntentionallyClosed = React.useRef(false);

    useEffect(() => {
        let interval: NodeJS.Timeout;
        let hintTimeout: NodeJS.Timeout;
        let ws: WebSocket | null = null;
        isIntentionallyClosed.current = false;

        if (gameState === 'waiting') {
            const token = localStorage.getItem('token');
            if (!token || token === 'undefined' || token === 'null') {
                alert("Please log in to play online.");
                setGameState('settings');
                router.push('/login');
                return;
            }

            const configPayload = {
                board_sizes: boardSizes,
                ruleset,
                time_control: {
                    mode: timePreset,
                    days_per_move: timePreset === 'correspondence' ? daysPerMove : undefined,
                    pause_on_weekends: timePreset === 'correspondence' ? pauseOnWeekends : undefined
                },
                ranked: isRanked,
                handicap
            };

            ws = new WebSocket(`ws://89.167.122.76:8800/v1/ws/queue?token=${token}&config=${encodeURIComponent(JSON.stringify(configPayload))}`);
            setSocket(ws);

            ws.onopen = () => {
                console.log("Connected to matchmaking queue");
            };

            let matchFoundRef = false;

            ws.onmessage = (event) => {
                const data = JSON.parse(event.data);
                if (data.type === 'match_found') {
                    console.log("Match found!", data);
                    matchFoundRef = true;
                    setGameState('found');
                    setTimeout(() => {
                        router.push(`/play/${data.match_id}`);
                    }, 2000);
                }
            };

            ws.onerror = (e) => {
                console.error("Queue WS error", e);
            };

            ws.onclose = (event) => {
                console.log("Queue WS closed", event.code);
                // 1008 is policy violation (unauthorized token)
                if (event.code === 1008) {
                    localStorage.removeItem('token');
                    setGameState('settings');
                    alert("Your session has expired or is invalid. Please login again to play online.");
                    router.push('/login');
                } else if (!matchFoundRef && gameState === 'waiting' && !isIntentionallyClosed.current) {
                    setGameState('settings');
                    alert("Connection lost. Please login again to play online.");
                    router.push('/login');
                }
            };

            interval = setInterval(() => {
                setWaitTime(prev => prev + 1);
            }, 1000);

            // Show hints after 15 seconds
            hintTimeout = setTimeout(() => setShowLongWaitHints(true), 15000);
        }

        return () => {
            if (interval) clearInterval(interval);
            if (hintTimeout) clearTimeout(hintTimeout);
            if (ws && ws.readyState === WebSocket.OPEN) {
                isIntentionallyClosed.current = true;
                ws.close();
            }
        };
    }, [gameState, timePreset, router]);

    const formatWaitTime = (seconds: number) => {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    };

    const handleCancel = () => {
        setGameState('settings');
        setWaitTime(0);
        setShowLongWaitHints(false);
    };

    // Rendering Helpers
    const renderSettings = () => (
        <div className="w-full max-w-[600px] mx-auto animate-fade-in-up">
            <div className="text-center mb-8">
                <h1 className="text-3xl font-semibold text-gray-900 mb-2 tracking-tight">Play vs People</h1>
                <p className="text-gray-500 text-sm">Fast pairing with a live player near your level</p>
            </div>

            <div className="bg-white rounded-[16px] sm:rounded-[24px] p-4 sm:p-5 shadow-2xl border border-gray-200 flex flex-col gap-4 sm:gap-5 relative w-full">
                {/* Fastest Queue Hint */}
                <div className="absolute top-0 left-0 right-0 bg-blue-500/10 border-b border-blue-500/20 py-1.5 flex items-center justify-center gap-2 text-blue-400 text-[10px] font-semibold uppercase tracking-widest">
                    <Zap className="w-3.5 h-3.5" />
                    Fastest queue right now: 9x9 Rapid
                </div>
                <div className="mt-1"></div>

                {/* BOARD SIZE */}
                <div>
                    <h3 className="text-gray-900 font-medium mb-1.5 sm:mb-2 text-[13px] flex items-center justify-between">
                        Board Size
                        <span className="text-xs text-gray-500 font-normal">Select one</span>
                    </h3>
                    <div className="grid grid-cols-3 gap-3">
                        {[9, 13, 19].map(size => (
                            <button
                                key={size}
                                onClick={() => {
                                    if (boardSizes.includes(size)) {
                                        if (boardSizes.length === 1) {
                                            setShakeBoardSize(true);
                                            setTimeout(() => setShakeBoardSize(false), 500);
                                        } else {
                                            setBoardSizes(boardSizes.filter(s => s !== size));
                                        }
                                    } else {
                                        setBoardSizes([...boardSizes, size].sort((a, b) => a - b));
                                    }
                                }}
                                className={`h-[36px] sm:h-10 rounded-lg sm:rounded-xl border text-sm font-medium transition-all ${boardSizes.includes(size)
                                    ? 'bg-blue-500/10 border-blue-500 text-blue-400 shadow-sm'
                                    : 'bg-gray-50 border-gray-200 text-gray-500 hover:border-gray-300'
                                    } ${shakeBoardSize && boardSizes.length === 1 && boardSizes.includes(size) ? 'animate-bounce' : ''}`}
                            >
                                {size}x{size}
                            </button>
                        ))}
                    </div>
                </div>

                {/* RULESET */}
                <div>
                    <h3 className="text-gray-900 font-medium mb-1.5 sm:mb-2 text-[13px] flex items-center justify-between">
                        Ruleset
                        <span className="text-xs text-gray-500 font-normal">Scoring & Komi</span>
                    </h3>
                    <div className="flex bg-gray-50 p-1 rounded-xl border border-gray-200 relative">
                        {['japanese', 'chinese'].map((rule) => (
                            <button
                                key={rule}
                                onClick={() => setRuleset(rule as any)}
                                className={`flex-1 py-1.5 sm:py-2 text-[11px] sm:text-xs font-medium rounded-lg transition-all z-10 ${ruleset === rule ? 'text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-900'
                                    }`}
                            >
                                {rule === 'japanese' ? 'Japanese' : 'Chinese'}
                            </button>
                        ))}
                        <div className="absolute top-1 bottom-1 w-[calc(50%-4px)] bg-white rounded-lg transition-transform duration-200 ease-out border border-gray-200"
                            style={{
                                transform: `translateX(${ruleset === 'japanese' ? '0' : '100%'})`,
                                left: ruleset === 'japanese' ? '4px' : '8px'
                            }}
                        ></div>
                    </div>
                </div>

                {/* OPPONENT STRENGTH */}
                <div>
                    <h3 className="text-gray-900 font-medium mb-1.5 sm:mb-2 text-[13px] flex items-center justify-between">
                        Opponent Level
                        <span className="text-xs text-gray-500 font-normal">Target preference</span>
                    </h3>
                    <div className="flex bg-gray-50 p-1 rounded-xl border border-gray-200 relative">
                        {['easier', 'around', 'stronger'].map((lvl) => (
                            <button
                                key={lvl}
                                onClick={() => setStrength(lvl as any)}
                                className={`flex-1 py-1.5 sm:py-2 text-[11px] sm:text-xs font-medium rounded-lg transition-all z-10 ${strength === lvl ? 'text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-900'
                                    }`}
                            >
                                {lvl === 'easier' ? 'Easier' : lvl === 'around' ? 'Around my level' : 'Stronger'}
                            </button>
                        ))}
                        {/* Selector indicator */}
                        <div className="absolute top-1 bottom-1 w-[calc(33.33%-2.66px)] bg-white rounded-lg transition-transform duration-200 ease-out border border-gray-200"
                            style={{
                                transform: `translateX(${strength === 'easier' ? '0' : strength === 'around' ? '100%' : '200%'})`,
                                left: strength === 'easier' ? '4px' : strength === 'around' ? '6px' : '8px'
                            }}
                        ></div>
                    </div>
                </div>

                {/* TIME PRESET */}
                <div>
                    <h3 className="text-gray-900 font-medium mb-1.5 sm:mb-2 text-[13px]">Time Control</h3>
                    <div className="flex flex-col gap-1.5 sm:gap-2">
                        {[
                            { id: 'blitz', name: 'Blitz', icon: Zap, desc: 'Very fast. 3-5 min total pace.' },
                            { id: 'rapid', name: 'Rapid', icon: Clock, desc: 'Medium pace. 10-15 min total.' },
                            { id: 'standard', name: 'Standard', icon: Target, desc: 'Full game pace. Deep thinking.' },
                            { id: 'correspondence', name: 'Correspondence', icon: Clock, desc: 'Slow play. ~1 move per day.' }
                        ].map(t => (
                            <div
                                key={t.id}
                                onClick={() => {
                                    setTimePreset(t.id as any);
                                    if (t.id === 'correspondence') setIsRanked(false);
                                }}
                                className={`flex items-center gap-3 p-2 sm:p-3 rounded-xl border cursor-pointer transition-all ${timePreset === t.id
                                    ? 'bg-[#E8F5EE] border-[#4CAF84] shadow-sm'
                                    : 'bg-gray-50 border-gray-200 hover:border-gray-300 hover:bg-gray-100'
                                    }`}
                            >
                                <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center ${timePreset === t.id ? 'bg-[#E8F5EE] text-[#4CAF84]' : 'bg-white/5 text-gray-500'}`}>
                                    <t.icon className="w-5 h-5" />
                                </div>
                                <div className="flex-1">
                                    <div className={`font-semibold text-sm ${timePreset === t.id ? 'text-[#4CAF84]' : 'text-gray-700'}`}>{t.name}</div>
                                    <div className="text-[10px] sm:text-xs text-gray-500">{t.desc}</div>
                                </div>
                                <div className={`w-4 h-4 sm:w-5 sm:h-5 rounded-full border-2 flex items-center justify-center transition-colors ${timePreset === t.id ? 'border-[#4CAF84] bg-[#4CAF84]' : 'border-gray-300'}`}>
                                    {timePreset === t.id && <Check className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-black" />}
                                </div>
                            </div>
                        ))}

                        {timePreset === 'correspondence' && (
                            <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                className="bg-gray-50 p-4 rounded-xl border border-[#4CAF84]/20 mt-1 flex flex-col gap-4 overflow-hidden"
                            >
                                <div className="flex justify-between items-center">
                                    <div className="text-gray-900 text-sm font-medium">Days per move</div>
                                    <select
                                        value={daysPerMove}
                                        onChange={(e) => setDaysPerMove(Number(e.target.value))}
                                        className="bg-white border border-gray-200 rounded-lg text-gray-900 text-sm px-3 py-1.5 outline-none focus:border-[#4CAF84]"
                                    >
                                        <option value={1}>1 day</option>
                                        <option value={2}>2 days</option>
                                        <option value={3}>3 days</option>
                                        <option value={7}>7 days</option>
                                        <option value={14}>14 days</option>
                                    </select>
                                </div>
                                <div className="flex justify-between items-center cursor-pointer" onClick={() => setPauseOnWeekends(!pauseOnWeekends)}>
                                    <div>
                                        <div className="text-gray-900 text-sm font-medium">Pause on weekends</div>
                                        <div className="text-xs text-gray-500">Clock pauses Sat & Sun (UTC)</div>
                                    </div>
                                    <button className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${pauseOnWeekends ? 'bg-[#4CAF84]' : 'bg-gray-300'}`}>
                                        <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${pauseOnWeekends ? 'translate-x-5' : 'translate-x-0'}`} />
                                    </button>
                                </div>
                            </motion.div>
                        )}
                    </div>
                </div>

                {/* RATED TOGGLE */}
                <div
                    className={`pt-2.5 sm:pt-4 border-t border-gray-200 flex items-center justify-between ${timePreset === 'correspondence' ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                    onClick={() => {
                        if (timePreset !== 'correspondence') setIsRanked(!isRanked);
                    }}
                >
                    <div>
                        <div className="text-gray-900 text-sm font-medium">Ranked Match</div>
                        <div className="text-xs text-gray-500">
                            {timePreset === 'correspondence' ? 'Correspondence games are unranked' : 'Affects your overall ladder rating'}
                        </div>
                    </div>
                    <button className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${isRanked ? 'bg-[#4CAF84]' : 'bg-gray-300'}`}>
                        <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${isRanked ? 'translate-x-5' : 'translate-x-0'}`} />
                    </button>
                </div>

                {/* MORE OPTIONS */}
                <div className="pt-2.5 sm:pt-4 border-t border-gray-200">
                    <button
                        onClick={() => setShowMoreOptions(!showMoreOptions)}
                        className="flex items-center gap-2 text-gray-500 hover:text-gray-900 text-sm font-medium transition-colors outline-none"
                    >
                        More Options
                        <ChevronLeft className={`w-4 h-4 transition-transform duration-200 ${showMoreOptions ? '-rotate-90' : 'rotate-180'}`} />
                    </button>

                    <AnimatePresence>
                        {showMoreOptions && (
                            <motion.div
                                initial={{ opacity: 0, height: 0, marginTop: 0 }}
                                animate={{ opacity: 1, height: 'auto', marginTop: 16 }}
                                exit={{ opacity: 0, height: 0, marginTop: 0 }}
                                className="flex flex-col gap-4 overflow-hidden"
                            >
                                <div className="flex justify-between items-center text-sm">
                                    <div>
                                        <div className="text-gray-900 font-medium">Handicap</div>
                                        <div className="text-gray-500 text-xs">Stones given to weaker player</div>
                                    </div>
                                    <select
                                        value={handicap}
                                        onChange={(e) => setHandicap(e.target.value as any)}
                                        className="bg-white border border-gray-200 rounded-lg text-gray-900 text-sm px-3 py-1.5 outline-none focus:border-[#4CAF84] min-w-[100px]"
                                    >
                                        <option value="auto">Auto</option>
                                        <option value="none">None</option>
                                    </select>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                {/* CTA */}
                <button
                    onClick={() => {
                        const token = localStorage.getItem('token');
                        if (!token || token === 'undefined' || token === 'null') {
                            alert("Please log in to play online.");
                            router.push('/login');
                            return;
                        }
                        setGameState('waiting');
                    }}
                    className="w-full mt-0 sm:mt-1 h-11 sm:h-12 bg-gradient-to-r from-[#4CAF84] to-[#3B82F6] hover:from-blue-500 hover:to-blue-400 text-gray-900 rounded-lg sm:rounded-xl font-bold text-sm sm:text-base shadow-[0_0_20px_rgba(59,130,246,0.3)] transition-all flex items-center justify-center gap-2"
                >
                    <Search className="w-5 h-5" /> Find Match
                </button>
                <div className="text-center text-xs text-gray-500 -mt-4">
                    We'll look for an opponent with similar settings
                </div>
            </div>
        </div>
    );

    const renderWaitingContent = (isFound: boolean) => {
        return (
            <div className="flex flex-col items-center">
                {isFound ? (
                    <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="flex flex-col items-center">
                        <div className="w-[80px] h-[80px] rounded-full bg-gradient-to-tr from-green-500 to-[#E9C46A] flex items-center justify-center shadow-[0_0_40px_rgba(76,175,132,0.4)] mb-4 border-[4px] border-[#111]">
                            <Check className="w-10 h-10 text-gray-900" strokeWidth={3} />
                        </div>
                        <h3 className="text-[28px] font-black tracking-tight text-white drop-shadow-lg mb-1">Match Intercepted</h3>
                        <span className="text-[13px] font-bold text-gray-300 uppercase tracking-widest mt-1">Connecting to Arena...</span>
                    </motion.div>
                ) : (
                    <div className="flex flex-col items-center">
                        <div className="relative w-20 h-20 mb-6 drop-shadow-[0_0_25px_rgba(59,130,246,0.3)]">
                            <div className="absolute inset-0 border-[6px] border-gray-600 rounded-full"></div>
                            <div className="absolute inset-0 border-[6px] border-transparent border-t-[#3B82F6] rounded-full animate-spin"></div>
                        </div>
                        <h3 className="text-[24px] font-bold text-white drop-shadow-md tracking-tight">Searching for Opponent</h3>
                        <div className="mt-3 font-mono text-[24px] font-black text-[#4CAF84] tracking-wider drop-shadow-sm">{formatWaitTime(waitTime)}</div>
                    </div>
                )}
                
                <div className="w-[300px] flex flex-col gap-6 shrink-0 mt-8">
                    <div className="bg-white/10 backdrop-blur-md rounded-[20px] p-6 border border-white/10 shadow-2xl relative overflow-hidden">
                        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#4CAF84] to-[#3B82F6]"></div>
                        <h2 className="text-[14px] font-bold text-gray-300 uppercase tracking-widest mb-4 flex items-center justify-between">Queue Status</h2>
                        <div className="flex flex-col gap-3 mb-8">
                            <div className="flex justify-between items-center text-[13px]"><span className="text-gray-400 font-medium">Board Size</span><span className="text-white font-bold">{boardSizes.map(s => `${s}x${s}`).join(', ')}</span></div>
                            <div className="flex justify-between items-center text-[13px]"><span className="text-gray-400 font-medium">Time Preset</span><span className="text-white font-bold capitalize">{timePreset}</span></div>
                            <div className="flex justify-between items-center text-[13px]"><span className="text-gray-400 font-medium">Mode</span><span className="text-white font-bold flex items-center gap-1.5">{isRanked ? <div className="w-1.5 h-1.5 rounded-full bg-green-500" /> : <div className="w-1.5 h-1.5 rounded-full bg-gray-500" />}{isRanked ? 'Ranked' : 'Casual'}</span></div>
                        </div>
                        {!isFound && (
                            <button onClick={handleCancel} className="w-full h-[46px] bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-xl font-bold transition-colors border border-red-500/20 flex items-center justify-center gap-2 text-[14px]">
                                <XCircle className="w-4 h-4" /> Cancel Search
                            </button>
                        )}
                    </div>
                </div>
            </div>
        );
    };

    const renderWaiting = () => renderWaitingContent(false);
    const renderMatchFound = () => renderWaitingContent(true);

    const renderLiveGame = () => {
        // Obsolete rendering block. Real live games route exclusively to [match_id].tsx
        return <div className="hidden" />;
    };

    const renderResult = () => (
        <div className="w-full max-w-[500px] mx-auto animate-fade-in-up mt-12">
            <div className="bg-white rounded-3xl p-8 shadow-2xl border border-gray-200 flex flex-col items-center justify-center text-center relative overflow-hidden">
                <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-green-600 to-green-400"></div>

                <h2 className="text-4xl font-bold text-gray-900 mb-2 tracking-tight mt-4">Victory!</h2>
                <p className="text-gray-500 mb-8">You won against Opponent</p>

                <div className="w-full bg-gray-50 border border-gray-200 rounded-2xl p-6 mb-8 flex justify-between items-center text-left">
                    <div>
                        <div className="text-xs text-gray-500 uppercase tracking-wider font-bold mb-1">Your Rank</div>
                        <div className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                            2k <span className="text-green-500 text-sm font-medium flex items-center">↑ 1k</span>
                        </div>
                    </div>
                    <div className="text-right">
                        <div className="text-xs text-gray-500 uppercase tracking-wider font-bold mb-1">Score</div>
                        <div className="text-xl font-bold text-gray-900">B+15.5</div>
                    </div>
                </div>

                <div className="flex gap-4 w-full">
                    <Link href="/play" className="flex-1 py-4 bg-white hover:bg-[#333] border border-gray-200 text-gray-900 rounded-xl font-medium transition-colors">
                        Back to Play
                    </Link>
                    <button onClick={() => setGameState('settings')} className="flex-1 py-4 bg-[#4CAF84] hover:bg-[#d4b059] text-black rounded-xl font-bold transition-colors shadow-lg">
                        Play Again
                    </button>
                </div>
            </div>
        </div>
    );

    return (
        <div className="min-h-[100dvh] bg-[#FDFCF9] text-gray-900 font-sans flex flex-col items-center justify-center pt-[80px] pb-[40px] px-4 relative overflow-x-hidden selection:bg-[#4CAF84]">
            <Head>
                <title>Online Match - GoAI</title>
                <style dangerouslySetInnerHTML={{
                    __html: `
                    /* Glassmorphism Styles */
                    .theater-glass {
                        width: 260px !important;
                        padding: 20px !important;
                        border-radius: 20px !important;
                        background: rgba(255, 255, 255, 0.05) !important;
                        backdrop-filter: blur(14px) !important;
                        -webkit-backdrop-filter: blur(14px) !important;
                        border: 1px solid rgba(255, 255, 255, 0.08) !important;
                        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.05) !important;
                    }
                    .theater-glass::before {
                        content: "";
                        position: absolute;
                        inset: 0;
                        border-radius: 20px;
                        background: radial-gradient(circle at 30% 20%, rgba(255, 180, 100, 0.15), transparent 60%);
                        pointer-events: none;
                        opacity: 0;
                        transition: opacity 1s ease-out;
                    }
                    .theater-glass.active {
                        border: 1px solid rgba(255, 200, 120, 0.3) !important;
                        animation: pulseGlow 2.5s infinite;
                    }
                    .theater-glass.active::before {
                        opacity: 1;
                    }

                    @keyframes pulseGlow {
                        0% { box-shadow: 0 0 10px rgba(255,180,100,0.2), 0 8px 32px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.05) !important; }
                        50% { box-shadow: 0 0 25px rgba(255,180,100,0.4), 0 8px 32px rgba(0, 0, 0, 0.6), inset 0 1px 0 rgba(255, 255, 255, 0.05) !important; }
                        100% { box-shadow: 0 0 10px rgba(255,180,100,0.2), 0 8px 32px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.05) !important; }
                    }
                    .theater-glass-avatar {
                        background: radial-gradient(circle at 30% 30%, #d4f5e9, #7cc9a8) !important;
                        box-shadow: inset 0 2px 6px rgba(0,0,0,0.2), 0 4px 10px rgba(0,0,0,0.3) !important;
                    }
                    .theater-glass-name {
                        color: #f5f5f5 !important;
                    }
                    .theater-glass-meta {
                        color: rgba(255,255,255,0.6) !important;
                    }
                    
                    /* THEATER MODE OVERRIDING HEADER */
                    header, header span, header a, header div {
                        transition: background-color 2.5s ease-out, color 2.5s ease-out, border-color 2.5s ease-out, box-shadow 2.5s ease-out !important;
                    }
                    body.theater-running header {
                        background-color: rgba(255, 255, 255, 0.05) !important;
                        backdrop-filter: blur(14px) !important;
                        -webkit-backdrop-filter: blur(14px) !important;
                        border-bottom-color: rgba(255, 255, 255, 0.08) !important;
                        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.05) !important;
                    }
                    body.theater-running header span[class*="text-gray-900"] {
                        color: white !important;
                    }
                    body.theater-running header a[class*="text-gray-500"] {
                        color: rgba(255, 255, 255, 0.6) !important;
                    }
                    body.theater-running header a[class*="hover:text-gray-900"]:hover {
                        color: white !important;
                    }
                    body.theater-running header a[class*="text-gray-800"] {
                        color: white !important;
                    }
                    body.theater-running header div[class*="bg-gray-100"] {
                        background-color: rgba(255,255,255,0.1) !important;
                        color: white !important;
                    }
                `}} />
            </Head>

            {/* THEATER MODE OVERLAY */}
            <div
                className={`fixed inset-0 pointer-events-none transition-colors duration-[2500ms] ease-out z-0 ${(gameState === 'found') ? 'bg-neutral-950/85' : 'bg-transparent'}`}
            />

            {/* MAIN 3-ZONE LAYOUT */}
            <div className="w-full max-w-[1920px] flex flex-col items-center justify-center relative z-10 flex-1">
                <main className="w-full flex flex-col xl:flex-row gap-[24px] justify-center items-center">
                    
                    {/* Left Flank: Player Cards */}
                    <div className={`w-full flex xl:flex-col gap-[24px] shrink-0 order-2 xl:order-1 pt-4 transition-all duration-1000 xl:w-[200px]`}>
                        {/* Player Card (YOU) */}
                        <div className={`flex-1 xl:flex-none bg-[#FFFFFF] rounded-[16px] p-[16px] shadow-[0_10px_25px_rgba(0,0,0,0.05)] flex flex-col items-center relative isolation-auto transition-all duration-1000 ease-out hover:-translate-y-[2px] ${gameState === 'found' ? 'theater-glass' : ''}`}>
                            <div className={`w-[72px] h-[72px] rounded-full bg-[#1A1A1A] flex items-center justify-center mb-3 transition-all duration-1000 ${gameState === 'found' ? 'theater-glass-avatar' : ''}`}>
                                <User className="w-9 h-9 text-white" />
                            </div>
                            <div className={`font-bold text-gray-900 text-[15px] transition-colors duration-1000 ${gameState === 'found' ? 'theater-glass-name' : ''}`}>{user?.username || 'You'}</div>
                            <div className={`text-[13px] font-bold mb-4 transition-colors duration-1000 ${gameState === 'found' ? 'theater-glass-meta' : 'text-[#4CAF84]'}`}>{user?.rank || '25k'}</div>
                        </div>

                        {/* Opponent Card */}
                        <div className={`flex-1 xl:flex-none bg-[#FFFFFF] rounded-[16px] p-[16px] shadow-[0_10px_25px_rgba(0,0,0,0.05)] flex flex-col items-center relative isolation-auto transition-all duration-1000 ease-out hover:-translate-y-[2px] ${gameState === 'found' ? 'theater-glass' : 'opacity-70 grayscale'}`}>
                            {gameState === 'found' && <div className="absolute inset-0 pointer-events-none rounded-[16px] animate-pulse bg-blue-500/5" />}
                            <div className={`w-[72px] h-[72px] rounded-full flex items-center justify-center mb-3 transition-all duration-1000 ${gameState === 'found' ? 'theater-glass-avatar bg-[#E5F1EB]' : 'bg-gray-50 border border-gray-300 border-dashed'}`}>
                                {gameState === 'found' ? <Cpu className="w-9 h-9 text-[#4CAF84]" /> : <Search className="w-6 h-6 text-gray-500" />}
                            </div>
                            <div className={`font-bold text-gray-900 text-[15px] transition-colors duration-1000 ${gameState === 'found' ? 'theater-glass-name' : ''}`}>
                                {gameState === 'found' ? 'Opponent Found' : 'Scanning...'}
                            </div>
                            <div className={`text-[13px] font-bold mb-4 transition-colors duration-1000 ${gameState === 'found' ? 'theater-glass-meta' : 'text-gray-400'}`}>
                                {gameState === 'found' ? 'Connecting...' : 'Pending'}
                            </div>
                        </div>
                    </div>

                    {/* Center Flank: Board */}
                    <div className="flex-1 flex flex-col items-center justify-center shrink-0 min-w-[300px] w-full xl:max-w-[70vw] order-1 xl:order-2 gap-[24px] z-20 overflow-visible xl:px-4">
                        <div className="w-full flex items-center justify-center relative my-2 sm:my-4">
                            
                            {/* THEATER MODE BOWLS (Right Flank) */}
                            <div className={`absolute top-[52%] z-[5] hidden xl:flex flex-col pointer-events-none transition-all duration-[800ms] ease-[cubic-bezier(0.4,0,0.2,1)] origin-right gap-[20px]`}
                                style={{ transform: 'translateY(-50%)', right: '-80px' }}
                            >
                                <img src="/white_lid.png" alt="White Stones" className="w-[180px] h-auto object-contain drop-shadow-2xl brightness-95" />
                                <img src="/black_lid.png" alt="Black Stones" className="w-[180px] h-auto object-contain drop-shadow-2xl brightness-95" />
                            </div>

                            <div className="relative inline-flex items-center justify-center w-full max-w-[800px] aspect-square">
                                <div
                                    className="relative select-none shadow-[rgba(0,0,0,0.4)_0px_20px_40px_-10px] w-[min(800px,90vw)] h-[min(800px,90vw)] rounded-[4px] transition-opacity duration-1000"
                                    style={{
                                        backgroundImage: "url('/board-19.png')",
                                        backgroundSize: '100% 100%',
                                        backgroundPosition: 'center',
                                        backgroundRepeat: 'no-repeat',
                                        opacity: gameState === 'found' ? 0.8 : 1
                                    }}
                                />
                            </div>
                        </div>
                    </div>

                </main>
            </div>

            {/* SETUP OVERLAY MODAL */}
            <AnimatePresence>
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-black/10 backdrop-blur-sm px-4"
                >
                    {/* SUB-HEADER (title) */}
                    {gameState !== 'live' && gameState !== 'found' && gameState !== 'waiting' && (
                        <div className="text-center mb-6 z-10 pt-20">
                            <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight drop-shadow-lg">Play vs People</h1>
                            <p className="text-white/80 font-medium text-[15px] mt-1 drop-shadow">Fast pairing with a live player near your level</p>
                        </div>
                    )}
                    
                    <div className="w-full max-w-[500px]">
                        {gameState === 'settings' ? renderSettings() : gameState === 'result' ? renderResult() : renderWaiting()}
                    </div>
                </motion.div>
            </AnimatePresence>
        </div>
    );
}
