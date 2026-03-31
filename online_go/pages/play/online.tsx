import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { ChevronLeft, User, Cpu, Check, Clock, Zap, Target, Search, XCircle, RotateCcw, Play } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

type MatchState = 'settings' | 'waiting' | 'found' | 'live' | 'result';



// --- TIERED TIME CONTROL DATA ---
const TIME_CONFIG = {
    9: {
        fast: { label: '~5 min', presets: [{ id: '9_f_1', label: '30 sec + 5 sec' }, { id: '9_f_2', label: '30 sec + 5x10 sec' }] },
        medium: { label: '~10 min', presets: [{ id: '9_m_1', label: '2 min + 7 sec' }, { id: '9_m_2', label: '2 min + 5x30 sec' }] },
        long: { label: '~15 min', presets: [{ id: '9_l_1', label: '3 min + 10 sec' }, { id: '9_l_2', label: '5 min + 5x30 sec' }] }
    },
    13: {
        fast: { label: '~10 min', presets: [{ id: '13_f_1', label: '30 sec + 5 sec' }, { id: '13_f_2', label: '30 sec + 5x10 sec' }] },
        medium: { label: '~20 min', presets: [{ id: '13_m_1', label: '3 min + 7 sec' }, { id: '13_m_2', label: '3 min + 5x30 sec' }] },
        long: { label: '~30 min', presets: [{ id: '13_l_1', label: '5 min + 10 sec' }, { id: '13_l_2', label: '10 min + 5x30 sec' }] }
    },
    19: {
        fast: { label: '~15 min', presets: [{ id: '19_f_1', label: '30 sec + 5 sec' }, { id: '19_f_2', label: '30 sec + 5x10 sec' }] },
        medium: { label: '~25 min', presets: [{ id: '19_m_1', label: '5 min + 7 sec' }, { id: '19_m_2', label: '5 min + 5x30 sec' }] },
        long: { label: '~40 min', presets: [{ id: '19_l_1', label: '10 min + 10 sec' }, { id: '19_l_2', label: '20 min + 5x30 sec' }] }
    }
};

const MODE_DESCRIPTIONS = {
    exact: "Find opponent matching this exact preset.",
    flexible: "Can match with nearby time settings.",
    multiple: "Play simultaneously against multiple opponents."
};

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
    const [boardSize, setBoardSize] = useState<number>(19);
    const [strength, setStrength] = useState<'easier' | 'around' | 'stronger'>('around');
    const [timeTier, setTimeTier] = useState<'fast' | 'medium' | 'long'>('medium');
    const [timePresetId, setTimePresetId] = useState<string>('preset_medium_1');
    const [timeMode, setTimeMode] = useState<'exact' | 'flexible' | 'multiple'>('exact');
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const [ruleset, setRuleset] = useState<'japanese' | 'chinese'>('japanese');

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
                board_sizes: [boardSize],
                ruleset,
                time_control: {
                    tier: timeTier,
                    preset: timePresetId,
                    mode: timeMode,
                    days_per_move: undefined,
                    pause_on_weekends: undefined
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
    }, [gameState, timeTier, timePresetId, timeMode, router, boardSize]);

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
            <style dangerouslySetInnerHTML={{
                __html: `
                                                                        .hero-zone {
                                            position: relative;
                                            padding: 28px 24px 20px;
                                            background: linear-gradient(180deg, rgba(255, 244, 230, 0.42) 0%, rgba(255, 255, 255, 0.18) 100%);
                                            border-top-left-radius: 28px;
                                            border-top-right-radius: 28px;
                                            display: flex;
                                            flex-direction: column;
                                            align-items: center;
                                            justify-content: center;
                                            text-align: center;
                                        }
                                        .hero-zone::before {
                                            content: ""; position: absolute; inset: 0;
                                            border-top-left-radius: 28px;
                                            border-top-right-radius: 28px;
                                            background: radial-gradient(circle at 50% 0%, rgba(255, 196, 128, 0.20), transparent 58%), linear-gradient(90deg, rgba(255,255,255,0.06), rgba(255,255,255,0.18), rgba(255,255,255,0.06));
                                            pointer-events: none;
                                        }
                                        .hero-title { font-size: 28px; font-weight: 700; color: #1b1b1b; letter-spacing: -0.03em; text-shadow: 0 1px 0 rgba(255,255,255,0.35); position: relative; z-index: 10; text-align: center; }
                                        .hero-subtitle { margin-top: 6px; font-size: 14px; line-height: 1.35; color: rgba(0,0,0,0.48); position: relative; z-index: 10; text-align: center; }
                                        .hero-content { padding: 20px 24px 24px; }

                .setup-panel {
                    background: linear-gradient(180deg, rgba(255,255,255,0.9), rgba(245,245,245,0.85));
                    backdrop-filter: blur(16px);
                    -webkit-backdrop-filter: blur(16px);
                    border-radius: 28px;
                    border: 1px solid rgba(255,255,255,0.38);
                    box-shadow: 0 24px 60px rgba(25,18,12,0.12), 0 8px 24px rgba(25,18,12,0.08), inset 0 1px 0 rgba(255,255,255,0.7), inset 0 -1px 0 rgba(255,255,255,0.22);
                    position: relative;
                }
                .setup-panel::before {
                    content: ""; position: absolute; inset: 0; border-radius: inherit; pointer-events: none;
                    background: radial-gradient(circle at 22% 12%, rgba(255,210,150,0.22), transparent 40%), radial-gradient(circle at 75% 20%, rgba(255,235,210,0.12), transparent 42%);
                }
                .setup-section { padding: 8px 0; position: relative; z-index: 10; }
                .section-title { font-size: 15px; font-weight: 600; color: #1E1C19; display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px; text-shadow: 0 1px 0 rgba(255,255,255,0.6); }
                .section-subtitle { font-size: 12px; color: #6E675F; font-weight: 500; }
                
                .choice-chip {
                    background: linear-gradient(180deg, rgba(255,255,255,0.58), rgba(255,250,246,0.78));
                    border: 1px solid rgba(120,92,62,0.10);
                    border-radius: 12px;
                    box-shadow: 0 4px 10px rgba(40,24,12,0.05), inset 0 1px 0 rgba(255,255,255,0.78);
                    transition: all 0.2s ease; color: #6E675F; font-weight: 600; font-size: 14px;
                    padding: 8px 16px; display: flex; align-items: center; justify-content: center; cursor: pointer; text-align: center;
                }
                .choice-chip:hover { transform: translateY(-1px); background: linear-gradient(180deg, rgba(255,255,255,0.8), rgba(255,250,246,0.9)); }
                .choice-chip.active {
                    background: linear-gradient(180deg, rgba(255,225,188,0.95), rgba(255,206,152,0.82));
                    border: 1px solid rgba(195,138,74,0.38);
                    box-shadow: 0 10px 24px rgba(193,132,68,0.22), 0 0 18px rgba(255,184,108,0.14), inset 0 1px 0 rgba(255,255,255,0.62);
                    color: #7A4B1A; text-shadow: 0 1px 0 rgba(255,255,255,0.5);
                }
                
                .segment { 
                    background: linear-gradient(180deg, rgba(240,236,232,0.82), rgba(250,248,246,0.62));
                    border: 1px solid rgba(80,60,40,0.06);
                    border-radius: 14px; padding: 2px; display: flex; position: relative; 
                    box-shadow: inset 0 2px 8px rgba(45,30,20,0.05), inset 0 1px 0 rgba(255,255,255,0.45);
                }
                .segment-slider {
                    background: linear-gradient(180deg, rgba(255,255,255,0.92), rgba(252,248,245,0.88));
                    border: 1px solid rgba(90,70,50,0.08);
                    box-shadow: 0 6px 18px rgba(35,24,14,0.08), inset 0 1px 0 rgba(255,255,255,0.88);
                }
                .segment-btn { flex: 1; padding: 6px 0; font-size: 13px; font-weight: 600; text-align: center; color: #6E675F; border-radius: 12px; transition: all 0.2s; position: relative; z-index: 2; cursor: pointer; text-shadow: 0 1px 0 rgba(255,255,255,0.4); }
                .segment-active { color: #1E1C19 !important; }
                
                .time-tier {
                    background: linear-gradient(180deg, rgba(255,255,255,0.72), rgba(248,244,240,0.88));
                    border: 1px solid rgba(80,60,40,0.08);
                    border-radius: 20px;
                    box-shadow: 0 12px 28px rgba(35,22,12,0.08), inset 0 1px 0 rgba(255,255,255,0.75);
                    padding: 14px 12px; transition: all 0.25s ease; cursor: pointer; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; flex: 1;
                }
                .time-tier:hover { transform: translateY(-2px); box-shadow: 0 14px 30px rgba(35,22,12,0.10); }
                .time-tier.active {
                    background: linear-gradient(180deg, rgba(255,225,188,0.95), rgba(255,206,152,0.85));
                    border: 1px solid rgba(195,138,74,0.38);
                    box-shadow: 0 14px 30px rgba(193,132,68,0.22), 0 0 20px rgba(255,184,108,0.18), inset 0 1px 0 rgba(255,255,255,0.6);
                }
                

                .dropdown {
                    background: linear-gradient(180deg, rgba(255,255,255,0.85), rgba(248,244,240,0.92));
                    backdrop-filter: blur(12px);
                    -webkit-backdrop-filter: blur(12px);
                    border: 1px solid rgba(80,60,40,0.08);
                    box-shadow: 0 18px 40px rgba(25,18,12,0.15);
                    border-radius: 16px; overflow: hidden;
                    position: absolute; top: calc(100% + 4px); right: 0; min-width: 220px; z-index: 50;
                }
                .dropdown-item {
                    padding: 10px 14px; cursor: pointer; transition: background 0.2s;
                    border-bottom: 1px solid rgba(80,60,40,0.04);
                }
                .dropdown-item:last-child { border-bottom: none; }
                .dropdown-item:hover { background: rgba(255,235,210,0.4); }
                .dropdown-item.active { background: rgba(255,225,188,0.5); }
                
                .premium-divider { height: 1px; background: linear-gradient(90deg, transparent, rgba(70,50,30,0.1), transparent); margin: 2px 0; position: relative; z-index: 10; }
                
                .premium-toggle {
                    background: linear-gradient(180deg, rgba(240,236,232,0.82), rgba(250,248,246,0.62));
                    border: 1px solid rgba(80,60,40,0.06);
                    box-shadow: inset 0 2px 8px rgba(45,30,20,0.1), inset 0 1px 0 rgba(255,255,255,0.45);
                    transition: all 0.3s; 
                }
                .premium-toggle.active { 
                    background: linear-gradient(90deg, #7fd9a8, #4fae7c);
                    border-color: rgba(88,164,123,0.34);
                    box-shadow: inset 0 2px 4px rgba(0,0,0,0.1); 
                }
                .cta-btn {
                    background: linear-gradient(180deg, #1a1a1a, #0f0f0f);
                    box-shadow: 0 12px 30px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.1);
                    color: #fce8d5;
                    border: 1px solid #000;
                }
                .cta-btn:hover {
                    background: linear-gradient(180deg, #2a2a2a, #151515);
                    box-shadow: 0 15px 35px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.15);
                }
                `
            }} />

            <div className="setup-panel flex flex-col relative w-full h-auto xl:max-h-[85vh] overflow-hidden">
                <div className="hero-zone shrink-0">
                    <button onClick={() => router.push('/')} className="absolute left-6 top-[28px] text-gray-800/40 hover:text-gray-900 transition-colors z-[50]">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" /></svg>
                    </button>
                    <div className="hero-title">Play vs People</div>
                    <div className="hero-subtitle">Fast pairing with a live player near your level</div>
                </div>

                <div className="hero-content flex flex-col overflow-y-auto pr-1 flex-1 z-10 space-y-3" style={{ scrollbarWidth: 'none' }}>

                    {/* BOARD SIZE */}
                    <div className="setup-section">
                        <div className="section-title">
                            Board Size
                            <span className="section-subtitle">Select one</span>
                        </div>
                        <div className="grid grid-cols-3 gap-2 mt-1.5">
                            {[9, 13, 19].map(size => (
                                <div
                                    key={size}
                                    onClick={() => {
                                        setBoardSize(size);
                                        // Reset tier options based on board size safely
                                        const presets = (TIME_CONFIG as any)[size][timeTier].presets;
                                        if (presets && presets.length > 0) {
                                            setTimePresetId(presets[0].id);
                                        }
                                    }}
                                    className={`choice-chip ${boardSize === size ? 'active' : ''}`}
                                >
                                    {size}x{size}
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="premium-divider" />

                    {/* RULESET */}
                    <div className="setup-section">
                        <div className="section-title">
                            Ruleset
                            <span className="section-subtitle">Scoring & Komi</span>
                        </div>
                        <div className="segment mt-1.5">
                            <div className="segment-slider absolute top-[2px] bottom-[2px] w-[calc(50%-2px)] rounded-[12px] transition-transform duration-200 ease-out"
                                style={{
                                    transform: `translateX(${ruleset === 'japanese' ? '0' : '100%'})`,
                                    left: ruleset === 'japanese' ? '2px' : '4px'
                                }}
                            ></div>
                            <div onClick={() => setRuleset('japanese')} className={`segment-btn ${ruleset === 'japanese' ? 'segment-active' : ''}`}>Japanese</div>
                            <div onClick={() => setRuleset('chinese')} className={`segment-btn ${ruleset === 'chinese' ? 'segment-active' : ''}`}>Chinese</div>
                        </div>
                    </div>

                    <div className="premium-divider" />



                    {/* MATCH TYPE */}
                    <div className="setup-section">
                        <div className="section-title">
                            Match Type
                            <span className="section-subtitle">Ranked Settings</span>
                        </div>
                        <div className="segment mt-1.5">
                            <div className="segment-slider absolute top-[2px] bottom-[2px] w-[calc(50%-2px)] rounded-[12px] transition-transform duration-200 ease-out"
                                style={{
                                    transform: `translateX(${isRanked ? '0' : '100%'})`,
                                    left: isRanked ? '2px' : '4px'
                                }}
                            ></div>
                            <div onClick={() => setIsRanked(true)} className={`segment-btn ${isRanked ? 'segment-active' : ''}`}>Ranked</div>
                            <div onClick={() => setIsRanked(false)} className={`segment-btn ${!isRanked ? 'segment-active' : ''}`}>Unranked</div>
                        </div>
                    </div>

                    <div className="premium-divider" />

                    {/* NEW TIME CONTROL BROWSER */}
                    <div className="setup-section">
                        <div className="section-title mb-2">
                            Time Control

                            {/* ADVANCED MODE DROPDOWN */}
                            <div className="relative">
                                <div
                                    className="text-[12px] font-bold text-[#A37549] flex items-center gap-1 cursor-pointer hover:opacity-80 transition-opacity bg-[rgba(255,235,210,0.3)] px-2 py-1 rounded-md"
                                    onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                                >
                                    Mode: {timeMode.charAt(0).toUpperCase() + timeMode.slice(1)}
                                    <svg className={`w-3 h-3 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                                </div>
                                <AnimatePresence>
                                    {isDropdownOpen && (
                                        <motion.div
                                            initial={{ opacity: 0, y: -5, scale: 0.95 }}
                                            animate={{ opacity: 1, y: 0, scale: 1 }}
                                            exit={{ opacity: 0, scale: 0.95 }}
                                            transition={{ duration: 0.15 }}
                                            className="dropdown"
                                        >
                                            {(['exact', 'flexible', 'multiple'] as const).map(mode => (
                                                <div
                                                    key={mode}
                                                    className={`dropdown-item ${timeMode === mode ? 'active' : ''}`}
                                                    onClick={() => { setTimeMode(mode); setIsDropdownOpen(false); }}
                                                >
                                                    <div className="text-[13px] font-bold text-[#1E1C19] flex items-center gap-2">
                                                        {timeMode === mode && <div className="w-1.5 h-1.5 rounded-full bg-[#A37549] shadow-[0_0_5px_rgba(163,117,73,0.5)]" />}
                                                        {mode.charAt(0).toUpperCase() + mode.slice(1)}
                                                    </div>
                                                    <div className="text-[11px] text-[#948C83] font-medium leading-tight mt-0.5">
                                                        {(MODE_DESCRIPTIONS as any)[mode]}
                                                    </div>
                                                </div>
                                            ))}
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>

                        </div>

                        {/* STEP 1: TIERS */}
                        <div className="flex gap-2 w-full mt-1">
                            {(['fast', 'medium', 'long'] as const).map(tier => (
                                <div
                                    key={tier}
                                    onClick={() => {
                                        setTimeTier(tier);
                                        const presets = (TIME_CONFIG as any)[boardSize][tier].presets;
                                        if (presets && presets.length > 0) {
                                            setTimePresetId(presets[0].id);
                                        }
                                    }}
                                    className={`time-tier ${timeTier === tier ? 'active' : ''}`}
                                >
                                    <div className="text-[10px] uppercase font-bold tracking-widest text-[#948C83] mb-1 leading-none">{tier}</div>
                                    <div className="text-[15px] font-black leading-none" style={{ color: timeTier === tier ? '#7A4B1A' : '#1E1C19' }}>
                                        {(TIME_CONFIG as any)[boardSize as 9 | 13 | 19][tier].label}
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* STEP 2: PRESETS */}
                        <div className="grid grid-cols-2 gap-2 mt-3 p-2 bg-[rgba(255,255,255,0.4)] rounded-2xl border border-[rgba(80,60,40,0.04)] shadow-[inset_0_2px_10px_rgba(45,30,20,0.02)]">
                            {((TIME_CONFIG as any)[boardSize as 9 | 13 | 19][timeTier].presets).map((preset: any) => (
                                <div
                                    key={preset.id}
                                    onClick={() => setTimePresetId(preset.id)}
                                    className={`choice-chip ${timePresetId === preset.id ? 'active' : ''}`}
                                >
                                    {preset.label}
                                </div>
                            ))}
                        </div>
                    </div>


                </div> {/* End of Settings Scroll Context */}

                {/* CTA */}
                <div className="pt-2 z-20 pb-0">
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
                        className="cta-btn w-full h-[48px] rounded-[16px] font-bold text-[14px] tracking-wide transition-all flex items-center justify-center gap-2 outline-none"
                    >
                        <Search className="w-4 h-4 opacity-90" /> Find Exact Match
                    </button>
                    <div className="text-center text-[11px] font-medium mt-2" style={{ color: '#948C83' }}>
                        We'll securely bridge your connection
                    </div>
                </div>
            </div>
        </div>
    );

    const renderWaitingContent = (isFound: boolean) => {
        return (
            <div className="flex flex-col items-center absolute inset-0 z-50 justify-center bg-transparent">
                {isFound ? (
                    <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="flex flex-col items-center">
                        <div className="w-[80px] h-[80px] rounded-full bg-gradient-to-tr from-[#4f8f6b] to-[#E9C46A] flex items-center justify-center shadow-[0_0_40px_rgba(255,200,140,0.2)] mb-4 border-[4px] border-[#1E1C19]">
                            <Check className="w-10 h-10 text-white" strokeWidth={3} />
                        </div>
                        <h3 className="text-[28px] font-black tracking-tight text-white drop-shadow-lg mb-1">Match Intercepted</h3>
                        <span className="text-[13px] font-bold text-[#E9C46A] uppercase tracking-widest mt-1">Connecting to Arena...</span>
                    </motion.div>
                ) : (
                    <div className="flex flex-col items-center">
                        <div className="relative w-20 h-20 mb-6 drop-shadow-[0_0_20px_rgba(255,210,150,0.2)]">
                            <div className="absolute inset-0 border-[4px] border-[#948C83]/20 rounded-full"></div>
                            <div className="absolute inset-0 border-[4px] border-transparent rounded-full animate-spin" style={{ borderTopColor: 'rgba(255, 210, 150, 0.85)' }}></div>
                        </div>
                        <h3 className="text-[24px] font-bold text-[#FDFCF9] drop-shadow-md tracking-tight">Searching for Opponent</h3>
                        <div className="mt-2 font-mono text-[24px] font-medium text-[#E9C46A] tracking-wider drop-shadow-sm">{formatWaitTime(waitTime)}</div>
                    </div>
                )}

                <div className="w-[300px] flex flex-col gap-6 shrink-0 mt-8">
                    <div className="rounded-[24px] p-6 shadow-2xl relative overflow-hidden backdrop-blur-md border border-[rgba(0,0,0,0.05)]" 
                         style={{ background: 'radial-gradient(circle at 30% 20%, rgba(255, 200, 140, 0.18), transparent 50%), rgba(255, 253, 250, 0.95)' }}>
                        <h2 className="text-[14px] font-bold text-[#1E1C19] uppercase tracking-widest mb-4 flex items-center justify-between">Queue Status</h2>
                        <div className="flex flex-col gap-2 mt-3 p-3 rounded-xl border border-[rgba(0,0,0,0.04)] shadow-inner" style={{ background: 'rgba(0,0,0,0.02)' }}>
                            <div className="flex justify-between items-center text-[13px]"><span className="font-medium" style={{ color: '#6E675F' }}>Board Size</span><span className="font-bold" style={{ color: '#1E1C19' }}>{boardSize}x{boardSize}</span></div>
                            <div className="flex justify-between items-center text-[13px]"><span className="font-medium" style={{ color: '#6E675F' }}>Rules</span><span className="font-bold capitalize" style={{ color: '#1E1C19' }}>{ruleset}</span></div>
                            <div className="flex justify-between items-center text-[13px]"><span className="font-medium" style={{ color: '#6E675F' }}>Mode</span>
                                <span className="font-bold flex items-center gap-1.5" style={{ color: '#1E1C19' }}>
                                    {isRanked ? <div className="w-1.5 h-1.5 rounded-full" style={{ background: '#4f8f6b' }} /> : <div className="w-1.5 h-1.5 rounded-full" style={{ background: '#948C83' }} />}
                                    {isRanked ? 'Ranked' : 'Casual'}
                                </span>
                            </div>
                        </div>
                        {!isFound && (
                            <button onClick={handleCancel} 
                                    className="w-full h-[46px] rounded-xl font-bold transition-colors flex items-center justify-center gap-2 text-[14px] mt-4"
                                    style={{ 
                                        background: 'rgba(0,0,0,0.12)', 
                                        color: 'rgba(0,0,0,0.55)', 
                                        border: '1px solid rgba(0,0,0,0.08)' 
                                    }}
                                    onMouseOver={(e) => e.currentTarget.style.background = 'rgba(0,0,0,0.18)'}
                                    onMouseOut={(e) => e.currentTarget.style.background = 'rgba(0,0,0,0.12)'}
                            >
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
                <title>Online Match - KAI</title>
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
                            <div className={`font-bold text-gray-900 text-[15px] transition-colors duration-1000 ${gameState === 'found' ? 'theater-glass-name' : ''}`}>{'You'}</div>
                            <div className={`text-[13px] font-bold mb-4 transition-colors duration-1000 ${gameState === 'found' ? 'theater-glass-meta' : 'text-[#4CAF84]'}`}>{'Ready'}</div>
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

                            <div className={`absolute top-[52%] z-[5] hidden xl:flex flex-col pointer-events-none transition-all duration-[800ms] ease-[cubic-bezier(0.4,0,0.2,1)] origin-right gap-[30px] mix-blend-multiply`}
                                style={{ transform: 'translateY(-50%)', right: '-200px' }}
                            >
                                {/* Group-level blend-mode drops the background flush into the lobby geometry without stacking-context isolation. */}
                                <img src="/assets/bowls_v3/woven_lid.png" alt="White Stones" className="w-[400px] h-[400px] object-contain" />
                                <img src="/assets/bowls_v3/woven_lid.png" alt="Black Stones" className="w-[400px] h-[400px] object-contain" />
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


                    <div className="w-full max-w-[500px]">
                        {gameState === 'settings' ? renderSettings() : gameState === 'result' ? renderResult() : renderWaiting()}
                    </div>
                </motion.div>
            </AnimatePresence>
        </div>
    );
}
