import React, { useState, useEffect, useRef, useMemo } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { motion, AnimatePresence } from 'framer-motion';
import { Settings, Flag, User, Cpu, ChevronLeft, ChevronRight, Activity, MessageSquare, ListTree, Undo2, Lightbulb, LineChart, ArrowLeft, Layers, X, Zap, Target, Clock, GraduationCap } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { GoBoard } from '../../components/GoBoard';

// Converts (row, col) to standard Go notation (e.g., "D4")
const xLabels = "ABCDEFGHJKLMNOPQRST";
const toCoordinates = (r, c, boardSize) => {
    const x = xLabels[c];
    const y = boardSize - r;
    return `${x}${y}`;
};

const API_BASE_URL = typeof window !== 'undefined'
    ? `${window.location.protocol}//${window.location.hostname}:8800`
    : 'http://89.167.122.76:8800';

const BOT_PROFILES = [
    { id: 'pebble', label: 'Puck', rank: '25k', style: 'Chaotic', desc: 'Plays fast and loose. Pure chaos and unpredictable moves.' },
    { id: 'sprout', label: 'Kenji', rank: '20k', style: 'Aggressive', desc: 'Aggressive but leaves many cutting points.' },
    { id: 'trainee', label: 'Yumi', rank: '15k', style: 'Territorial', desc: 'Focuses on defending territory, but easily tricked by traps.' },
    { id: 'clubber', label: 'Daiki', rank: '12k', style: 'Defensive', desc: 'A solid, defensive player. Takes time to build thick walls.' },
    { id: 'amateur', label: 'Takeshi', rank: '10k', style: 'Balanced', desc: 'A balanced player who loves trading territory for influence.' },
    { id: 'fighter', label: 'Ryu', rank: '8k', style: 'Fighter', desc: 'Relentless fighter. Will attack any weak group on the board.' },
    { id: 'defender', label: 'Hina', rank: '6k', style: 'Cautious', desc: 'Extremely cautious. Prefers a slow and steady territorial game.' },
    { id: 'strategist', label: 'Jin', rank: '5k', style: 'Strategic', desc: 'Focuses on the whole-board framework. Willing to sacrifice local gains.' },
    { id: 'expert', label: 'Akira', rank: '4k', style: 'Tactical', desc: 'Precise reader. Specializes in complicated local tactical fights.' },
    { id: 'sensei', label: 'Master Shen', rank: '3k+', style: 'Solid', desc: 'The master of balance. Capitalizes on every positional mistake.' }
];

const createEmptyBoard = (size) => Array(size).fill(null).map(() => Array(size).fill(null));

export default function ReactGoBoard() {
    const router = useRouter();
    const { user } = useAuth();
    // --- SETUP STATE --- //
    const [gameState, setGameState] = useState('setup'); // 'setup', 'playing', 'finished'
    const [boardSize, setBoardSize] = useState(19);
    const [timeTier, setTimeTier] = useState<'fast' | 'medium' | 'long'>('medium');
    const [timePresetId, setTimePresetId] = useState<string>('preset_medium_1');
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);

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

    const [timeControl, setTimeControl] = useState('byoyomi');
    const [botId, setBotId] = useState('amateur');
    const [ruleset, setRuleset] = useState('japanese');
    const [selectedQualityCategory, setSelectedQualityCategory] = useState(null);
    const [expandedMistake, setExpandedMistake] = useState<number | null>(null);
    const [showAnalysis, setShowAnalysis] = useState(false);

    // --- GAME STATE --- //
    const [board, setBoard] = useState(createEmptyBoard(19));
    const [currentPlayer, setCurrentPlayer] = useState('black');
    const [moveCount, setMoveCount] = useState(0);
    const [gameId, setGameId] = useState(null);
    const [winner, setWinner] = useState(null);

    const [blackTime, setBlackTime] = useState({ main: 0, periods: 0, periodLimit: 0, inByoyomi: false });
    const [whiteTime, setWhiteTime] = useState({ main: 0, periods: 0, periodLimit: 0, inByoyomi: false });

    const [captures, setCaptures] = useState({ black: 0, white: 0 });
    const [isBotThinking, setIsBotThinking] = useState(false);
    const [lastMove, setLastMove] = useState(null); // {r, c}

    // --- UI OPTIONS STATE --- //
    const [activeTab, setActiveTab] = useState('tree'); // 'chat' | 'analysis' | 'tree'
    const [moveHistory, setMoveHistory] = useState([]); // [{m: 1, c: 'Q16', p: 'b'}]
    const boardHistoryListRef = React.useRef([]); // Stores JSON.stringify(boards) for Positional Superko
    const [variationBranch, setVariationBranch] = useState([]); // [{m: 1, c: 'Q16', p: 'b'}]

    // --- AI TUTOR STATE --- //
    const [rawHints, setRawHints] = useState([]); // Array of up to 15 hints
    const [hintStrategy, setHintStrategy] = useState('balanced');
    const [winrate, setWinrate] = useState(null); // from 0.0 to 1.0 (Black's winrate)
    const [scoreLead, setScoreLead] = useState(null); // positive = Black leading
    const [showHints, setShowHints] = useState(false);
    const [showTerritory, setShowTerritory] = useState(false);
    const [currentOwnership, setCurrentOwnership] = useState(null);

    // --- MISTAKE TRAINER STATE --- //
    const [reviewMistakes, setReviewMistakes] = useState<any[]>([]);
    const [currentMistakeIndex, setCurrentMistakeIndex] = useState(0);
    const [isAnalyzingMistakes, setIsAnalyzingMistakes] = useState(false);
    const [mistakeTrainerBoard, setMistakeTrainerBoard] = useState<any>(null);
    const [trainerFeedback, setTrainerFeedback] = useState<any>(null);
    const [trainerAttemptCount, setTrainerAttemptCount] = useState(0);
    const [showTrainerOptions, setShowTrainerOptions] = useState(false);
    const [isGeneratingTsumego, setIsGeneratingTsumego] = useState(false);

    // --- GLOBAL HEADER THEATER SYNC --- //
    useEffect(() => {
        if (gameState === 'playing' || gameState === 'mistake_training') {
            document.body.classList.add('theater-running');
        } else {
            document.body.classList.remove('theater-running');
        }
        return () => document.body.classList.remove('theater-running');
    }, [gameState]);

    // --- LOCAL STORAGE PERSISTENCE --- //
    useEffect(() => {
        try {
            const savedSize = localStorage.getItem('katagoSetup_boardSize');
            if (savedSize) setBoardSize(Number(savedSize));
            const savedTimeControl = localStorage.getItem('katagoSetup_timeControl');
            if (savedTimeControl) setTimeControl(savedTimeControl);
            const savedBotId = localStorage.getItem('katagoSetup_botId');
            if (savedBotId) setBotId(savedBotId);
            const savedRuleset = localStorage.getItem('katagoSetup_ruleset');
            if (savedRuleset) setRuleset(savedRuleset);
            const savedHintStrategy = localStorage.getItem('katagoSetup_hintStrategy');
            if (savedHintStrategy) setHintStrategy(savedHintStrategy);
            const savedShowHints = localStorage.getItem('katagoSetup_showHints');
            if (savedShowHints) setShowHints(savedShowHints === 'true');
            const savedShowTerritory = localStorage.getItem('katagoSetup_showTerritory');
            if (savedShowTerritory) setShowTerritory(savedShowTerritory === 'true');
        } catch (e) { console.error(e); }
    }, []);

    useEffect(() => {
        if (gameState === 'setup') {
            localStorage.setItem('katagoSetup_boardSize', boardSize.toString());
            localStorage.setItem('katagoSetup_timeControl', timeControl);
            localStorage.setItem('katagoSetup_botId', botId);
            localStorage.setItem('katagoSetup_ruleset', ruleset);
        }
    }, [boardSize, timeControl, botId, ruleset, gameState]);

    useEffect(() => {
        localStorage.setItem('katagoSetup_hintStrategy', hintStrategy);
        localStorage.setItem('katagoSetup_showHints', showHints.toString());
        localStorage.setItem('katagoSetup_showTerritory', showTerritory.toString());
    }, [hintStrategy, showHints, showTerritory]);
    const [analysisHistory, setAnalysisHistory] = useState({}); // { ply: { winrate, scoreLead } }
    const [viewingMove, setViewingMove] = useState(null); // ply index for review mode
    const [graphMode, setGraphMode] = useState('winrate'); // 'winrate' | 'score'
    const [tuitionMode, setTuitionMode] = useState(false);
    const [tuitionCandidates, setTuitionCandidates] = useState<{ r: number, c: number }[]>([]);
    const [tuitionScore, setTuitionScore] = useState(0);

    const targetCandidates = boardSize === 9 ? 3 : (boardSize === 13 ? 5 : 7);

    // Persist scores
    useEffect(() => {
        if (gameState === 'finished' && tuitionScore > 0) {
            const currentTotal = parseInt(localStorage.getItem('katago_tuition_score') || '0', 10);
            localStorage.setItem('katago_tuition_score', (currentTotal + tuitionScore).toString());
        }
    }, [gameState, tuitionScore]);

    // --- DYNAMIC SIZING --- //
    const [boardPx, setBoardPx] = useState(640);

    useEffect(() => {
        const calculateBoardSize = () => {
            const width = window.innerWidth;
            const height = window.innerHeight;
            // Limit vertical growth by 240px buffer (header/footer bounds) to guarantee no scrolling is induced natively
            const availableHeight = height - 240;

            // Calculate the 70% width target requested by user
            const targetWidthPct = width * 0.70;

            if (width < 640) setBoardPx(Math.min(width - 16, availableHeight)); // Mobile
            else if (width < 1280) setBoardPx(Math.min(width - 400, availableHeight)); // Tablet
            else setBoardPx(Math.min(targetWidthPct, availableHeight)); // Desktop: Grow aggressively
        };

        calculateBoardSize();
        window.addEventListener('resize', calculateBoardSize);
        return () => window.removeEventListener('resize', calculateBoardSize);
    }, [boardSize]);

    // Board Metrics Calculation
    // Constants injected from CV2 + GPT-4o Root Cause Analysis
    // Abstracting visual bounds entirely into literal pixel-fraction geometry
    let fractionOffsetX, fractionDistanceX;
    let fractionOffsetY, fractionDistanceY;

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

    // Cell size physically constrained to the inner bounds
    const visualGaps = Math.max(1, boardSize - 1);
    const cellPxX = gridInnerWidth / visualGaps;
    const cellPxY = gridInnerHeight / visualGaps;

    // --- TIMER LOGIC --- //
    useEffect(() => {
        if (gameState !== 'playing' || winner) return;

        const timerId = setInterval(() => {
            const setTime = currentPlayer === 'black' ? setBlackTime : setWhiteTime;

            setTime(prev => {
                let { main, periods, inByoyomi, periodLimit } = prev;

                if (main > 0) {
                    main -= 1;
                }

                if (main === 0) {
                    if (timeControl === 'byoyomi' && periods > 0) {
                        main = periodLimit;
                        periods -= 1;
                        inByoyomi = true;
                    } else {
                        setWinner(currentPlayer === 'black' ? 'white_timeout' : 'black_timeout');
                        setGameState('finished');
                        return prev;
                    }
                }

                return { ...prev, main, periods, inByoyomi };
            });
        }, 1000);

        return () => clearInterval(timerId);
    }, [gameState, winner, currentPlayer, timeControl]);

    const handleTurnEnd = (player) => {
        const setTime = player === 'black' ? setBlackTime : setWhiteTime;
        setTime(prev => {
            if (timeControl === 'fischer') {
                return { ...prev, main: prev.main + prev.periodLimit };
            } else if (timeControl === 'byoyomi' && prev.inByoyomi) {
                return { ...prev, main: prev.periodLimit };
            }
            return prev;
        });
    };
    const audioCache = React.useRef<Record<string, HTMLAudioElement>>({});

    React.useEffect(() => {
        // Preload essential sound effects into memory to eliminate placement latency
        if (typeof window !== 'undefined') {
            const sounds = ['clack', 'capture', 'pass'];
            sounds.forEach(type => {
                const audio = new Audio(`/sounds/${type}.wav`);
                audio.volume = 0.5;
                audioCache.current[type] = audio;
            });
        }
    }, []);

    const playSound = React.useCallback((type, count = 1) => {
        try {
            if (count > 1 && type === 'capture') {
                const playCount = Math.min(count, 5); // Max 5 sounds to avoid blowing out speakers
                for (let i = 0; i < playCount; i++) {
                    setTimeout(() => {
                        try {
                            const baseAudio = audioCache.current[type];
                            if (baseAudio) {
                                const clone = baseAudio.cloneNode() as HTMLAudioElement;
                                clone.volume = Math.max(0.1, 0.5 - (i * 0.08)); // Fade out successive clacks
                                clone.play().catch(() => { });
                            }
                        } catch (e) { }
                    }, i * 90); // 90ms staggered delays simulates scooping stones rapidly
                }
                return;
            }
            const audio = audioCache.current[type] || new Audio(`/sounds/${type}.wav`);
            audio.volume = 0.5;
            audio.currentTime = 0; // instantly reset to start for rapid overlapping plays
            audio.play().catch(e => console.error("Audio block:", e));
        } catch (e) { }
    }, []);

    const handlePass = () => {
        if (currentPlayer !== 'black' || isBotThinking || gameState !== 'playing') return;
        playSound('pass');
        console.log('[Katago] Player passed');
        setMoveCount(prev => prev + 1);
        setRawHints([]);
        setMoveHistory(prev => [...prev, { m: prev.length + 1, c: 'PASS', p: 'b' }]);
        boardHistoryListRef.current.push(JSON.stringify(board));
        handleTurnEnd('black');
        setCurrentPlayer('white');
        triggerBotMove(board, null, "pass");
    };

    const handleResign = () => {
        if (gameState !== 'playing') return;
        setWinner(currentPlayer === 'black' ? 'white_resign' : 'black_resign');
        setGameState('finished');
        if (moveHistory.length >= 5) {
            handleReviewMistakes();
        }
    };

    const handleUndo = () => {
        if (moveHistory.length < 2 || isBotThinking || gameState !== 'playing') return;

        const newHistory = moveHistory.slice(0, -2);

        let tempBoard = createEmptyBoard(boardSize);
        let tempCaptures = { black: 0, white: 0 };
        let tempLastMove = null;

        for (const mv of newHistory) {
            if (mv.c !== 'PASS' && mv.c !== 'RESIGN') {
                const parsed = parseKataGoMove(mv.c, boardSize);
                if (parsed) {
                    const color = mv.p === 'b' ? 'black' : 'white';
                    const res = applyGoRules(tempBoard, color, parsed.r, parsed.c);
                    if (res) {
                        tempBoard = res.newBoard;
                        tempCaptures.black += color === 'black' ? res.capturedStones : 0;
                        tempCaptures.white += color === 'white' ? res.capturedStones : 0;
                        tempLastMove = { r: parsed.r, c: parsed.c };
                    }
                }
            }
        }

        setBoard(tempBoard);
        setCaptures(tempCaptures);
        setLastMove(tempLastMove);
        setMoveHistory(newHistory);
        boardHistoryListRef.current = boardHistoryListRef.current.slice(0, newHistory.length + 1);
        setMoveCount(newHistory.length);
        setCurrentPlayer('black');
        setRawHints([]);
        setWinrate(null);
        setScoreLead(null);
        setViewingMove(null);
        requestTutorAnalysis(tempBoard, 'black', newHistory.length);
    };

    const formatCurrentTime = (timeState) => {
        const { main } = timeState;
        const m = Math.floor(main / 60);
        const s = main % 60;
        return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    };

    const formatPeriods = (timeState) => {
        const { periods, periodLimit, inByoyomi } = timeState;
        if (timeControl === 'byoyomi') {
            if (inByoyomi) {
                return `${periods} / ${periodLimit}s`;
            }
            return `+ ${periods}x${periodLimit}s`;
        }
        if (timeControl === 'fischer') return `+ ${periodLimit}s`;
        return '';
    };

    const handleReviewMistakes = async () => {
        if (moveHistory.length < 5) return alert("Game is too short to analyze.");
        setIsAnalyzingMistakes(true);
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
                ruleset, komi: ruleset === 'chinese' ? 7.5 : 6.5,
                board_size: boardSize, black_stones, white_stones,
                to_play: i % 2 === 0 ? "B" : "W",
                last_move: i > 0 ? moveHistory[i - 1].c : null
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
                if (data.full_analysis) {
                    setAnalysisHistory(data.full_analysis);
                }
                const unifiedMistakes = data.mistakes || [];
                if (unifiedMistakes.length > 0) {
                    setReviewMistakes(unifiedMistakes);
                    setCurrentMistakeIndex(0);
                    // Decoupled the sandbox transition so the player can view the Mistake Selection Table statically
                    // setMistakeTrainerBoard(createEmptyBoard(boardSize)); // Will be hydrated
                    // setTrainerFeedback(null);
                    // setTrainerAttemptCount(0);
                    // setGameState('mistake_training');
                } else {
                    alert("Perfect game! KataGo found no critical mistakes for Black.");
                }
            } else {
                alert("Perfect game! KataGo found no critical mistakes.");
            }
        } catch (e) {
            setIsAnalyzingMistakes(false);
            alert("Failed to analyze mistakes.");
        }
    };

    const handleTrainerUndo = () => {
        const m = reviewMistakes[currentMistakeIndex];
        if (!m) return;
        const newBoard = createEmptyBoard(boardSize);
        (m.state_before.black_stones || []).forEach((c: string) => {
            const parsed = parseKataGoMove(c, boardSize);
            if (parsed) newBoard[parsed.r][parsed.c] = 'black';
        });
        (m.state_before.white_stones || []).forEach((c: string) => {
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

                // Imperatively force board hydration to dodge React hook race conditions on the same index
                const newBoard = createEmptyBoard(boardSize);
                (scenario.state_before.black_stones || []).forEach((c: string) => {
                    const parsed = parseKataGoMove(c, boardSize);
                    if (parsed) newBoard[parsed.r][parsed.c] = 'black';
                });
                (scenario.state_before.white_stones || []).forEach((c: string) => {
                    const parsed = parseKataGoMove(c, boardSize);
                    if (parsed) newBoard[parsed.r][parsed.c] = 'white';
                });

                setMistakeTrainerBoard(newBoard);
                setReviewMistakes(updatedMistakes);
                setTrainerAttemptCount(0);

                // Purge old 'Excellent!' feedback blockages, and just present the pedagogical concept text as an info banner
                // Wait, if we use setTrainerFeedback(null), where does the concept_explanation go?
                // The UI natively displays `concept_explanation` under the "Turn X Blunder" generic banner header (line 1443)!
                // We will NOT clutter the interactive trainer box.
                setTrainerFeedback(null);
            } else {
                setTrainerFeedback({ type: 'error', text: 'KataGo rejected the programmatic synthesis. Try again.' });
            }
        } catch (e) {
            setIsGeneratingTsumego(false);
            setTrainerFeedback({ type: 'error', text: 'Network connection failed.' });
        }
    };

    // Initialize game when setup is complete
    const handleStartMatch = async () => {
        setBoard(createEmptyBoard(boardSize));
        setCurrentPlayer('black');
        setMoveCount(0);
        setWinner(null);
        setCaptures({ black: 0, white: 0 });
        setLastMove(null);
        setMoveHistory([]);
        boardHistoryListRef.current = [JSON.stringify(createEmptyBoard(boardSize))];
        setRawHints([]);
        setWinrate(null);
        setScoreLead(null);

        let initialMain = 0;
        let initialPeriods = 0;
        let initialPeriodLimit = 0;

        const preset = (TIME_CONFIG as any)[boardSize as 9 | 13 | 19]?.[timeTier]?.presets.find((p: any) => p.id === timePresetId);
        if (preset) {
            let parts = preset.label.split('+');
            if (parts.length === 2) {
                let mainStr = parts[0].trim();
                let incStr = parts[1].trim();

                if (mainStr.includes('min')) initialMain = parseInt(mainStr) * 60;
                else if (mainStr.includes('sec')) initialMain = parseInt(mainStr);

                if (incStr.includes('x')) {
                    setTimeControl('byoyomi');
                    let pparts = incStr.split('x');
                    initialPeriods = parseInt(pparts[0]);
                    initialPeriodLimit = parseInt(pparts[1]);
                } else {
                    setTimeControl('fischer');
                    initialPeriodLimit = parseInt(incStr);
                }
            } else {
                initialMain = 600;
                setTimeControl('absolute');
            }
        } else if (timeControl === 'byoyomi') {
            initialMain = 300; // 5 mins
            initialPeriods = 5;
            initialPeriodLimit = 30;
        } else if (timeControl === 'fischer') {
            initialMain = 300; // 5 mins
            initialPeriodLimit = 10;
        }

        setBlackTime({ main: initialMain, periods: initialPeriods, periodLimit: initialPeriodLimit, inByoyomi: false });
        setWhiteTime({ main: initialMain, periods: initialPeriods, periodLimit: initialPeriodLimit, inByoyomi: false });

        setGameState('playing');

        // Notify KataGo API
        try {
            const res = await fetch('http://89.167.122.76:8800/v1/games/start', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ board_size: boardSize, rule_set: ruleset })
            });
            const data = await res.json();
            setGameId(data.game_id);
        } catch (err) {
            console.error("Failed to start KataGo game", err);
        }
    };

    const startHeroMatch = async () => {
        const boardStr = sessionStorage.getItem('heroBoardState');
        if (!boardStr) return handleStartMatch();
        let loadedBoard;
        try {
            loadedBoard = JSON.parse(boardStr);
        } catch (e) {
            return handleStartMatch();
        }

        const loadedSize = loadedBoard.length;
        setBoardSize(loadedSize);
        setBoard(loadedBoard);

        // Count stones to determine whose turn it is
        let blackCount = 0;
        let whiteCount = 0;
        for (let r = 0; r < loadedSize; r++) {
            for (let c = 0; c < loadedSize; c++) {
                if (loadedBoard[r][c] === 'black') blackCount++;
                if (loadedBoard[r][c] === 'white') whiteCount++;
            }
        }

        // If black and white have the same number of stones, it's black's turn
        // If black has more stones, it's white's turn
        const nextPlayer = blackCount > whiteCount ? 'white' : 'black';

        setCurrentPlayer(nextPlayer);
        setMoveCount(blackCount + whiteCount);
        setWinner(null);
        setCaptures({ black: 0, white: 0 });
        setLastMove(null);
        setMoveHistory([]);
        boardHistoryListRef.current = [JSON.stringify(loadedBoard)];
        setRawHints([]);
        setWinrate(null);
        setScoreLead(null);

        let initialMain = 300;
        let initialPeriods = 5;
        let initialPeriodLimit = 30;

        setBlackTime({ main: initialMain, periods: initialPeriods, periodLimit: initialPeriodLimit, inByoyomi: false });
        setWhiteTime({ main: initialMain, periods: initialPeriods, periodLimit: initialPeriodLimit, inByoyomi: false });

        setGameState('playing');

        try {
            const res = await fetch('http://89.167.122.76:8800/v1/games/start', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ board_size: loadedSize, rule_set: ruleset })
            });
            const data = await res.json();
            setGameId(data.game_id);
            if (nextPlayer === 'white') {
                triggerBotMove(loadedBoard, data.game_id);
            }
        } catch (err) {
            console.error("Failed to start KataGo game", err);
        }
    };

    useEffect(() => {
        if (!router.isReady) return;
        const auto = router.query.auto === 'true';
        const continueGame = router.query.continue === 'hero';

        if (auto && gameState === 'setup') {
            if (continueGame) {
                startHeroMatch();
            } else {
                handleStartMatch();
            }
            const { auto: _a, continue: _c, ...rest } = router.query;
            router.replace({ pathname: router.pathname, query: rest }, undefined, { shallow: true });
        }
    }, [router.isReady, router.query, gameState]);

    // --- GAME RULES ENGINE --- //
    const getNeighbors = (currentBoard, r, c) => {
        const size = currentBoard.length;
        const neighbors = [];
        if (r > 0) neighbors.push([r - 1, c]);
        if (r < size - 1) neighbors.push([r + 1, c]);
        if (c > 0) neighbors.push([r, c - 1]);
        if (c < size - 1) neighbors.push([r, c + 1]);
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

            for (const [nr, nc] of getNeighbors(currentBoard, r, c)) {
                if (currentBoard[nr][nc] === null) {
                    liberties.add(`${nr},${nc}`);
                } else if (currentBoard[nr][nc] === color && !visited.has(`${nr},${nc}`)) {
                    stack.push([nr, nc]);
                }
            }
        }
        return { chain, liberties: liberties.size };
    };

    const applyGoRules = (currentBoard, playerColor, moveR, moveC, priorBoards = []) => {
        const newBoard = currentBoard.map(row => [...row]);
        newBoard[moveR][moveC] = playerColor;
        const opponentColor = playerColor === 'black' ? 'white' : 'black';

        let capturedStones = 0;

        for (const [nr, nc] of getNeighbors(newBoard, moveR, moveC)) {
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

        const newBoardStr = JSON.stringify(newBoard);
        if (priorBoards.includes(newBoardStr)) {
            return null; // Ko / Positional Superko violation
        }

        return { newBoard, capturedStones };
    };

    // --- BOT INTEGRATION --- //
    const parseKataGoMove = (moveStr, currentBoardSize) => {
        if (!moveStr || moveStr.toUpperCase() === "PASS" || moveStr.toLowerCase() === "resign") return null;
        const xIndex = xLabels.indexOf(moveStr[0].toUpperCase());
        const y = parseInt(moveStr.substring(1), 10);
        const r = currentBoardSize - y;
        const c = xIndex;
        return { r, c };
    };

    const requestTutorAnalysis = async (currentBoard, toPlayColor, currentPly) => {
        if (gameState === 'finished') return;

        const blackStones = [];
        const whiteStones = [];
        const currentSize = currentBoard.length;

        for (let r = 0; r < currentSize; r++) {
            for (let c = 0; c < currentSize; c++) {
                if (currentBoard[r][c] === 'black') blackStones.push(toCoordinates(r, c, currentSize));
                if (currentBoard[r][c] === 'white') whiteStones.push(toCoordinates(r, c, currentSize));
            }
        }

        const payload = {
            request_id: crypto.randomUUID(),
            analysis_slot: "main-board",
            ruleset: ruleset,
            komi: ruleset === 'chinese' ? 7.5 : 6.5,
            board_size: currentSize,
            initial_position: {
                black: blackStones,
                white: whiteStones
            },
            moves_list: [],
            side_to_move: toPlayColor === 'white' ? "W" : "B",
            max_visits: 30, // Capped for CPU-only nodes
            max_top_moves: 5,
            time_budget_ms: 15000,
            include_ownership: true
        };

        try {
            const urlParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : new URLSearchParams();
            const engineFlag = urlParams.get('engine') ? `?engine=${urlParams.get('engine')}` : '';
            const res = await fetch(`${API_BASE_URL}/v1/analyze-position${engineFlag}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const data = await res.json();
            if (data.status === "success" && data.analysis) {
                const blackWinrate = data.analysis.winrate_black;
                const blackScoreLead = data.analysis.score_lead_black;

                setWinrate(blackWinrate !== undefined ? blackWinrate : null);
                setScoreLead(blackScoreLead !== undefined ? blackScoreLead : null);

                const hints = data.analysis.top_moves.map((tm: any) => ({
                    move: tm.move,
                    winrate: tm.winrate_black,
                    scoreLead: tm.score_lead_black,
                    pv: tm.pv,
                    visits: tm.visits,
                    prior: tm.policy
                }));
                setRawHints(hints || []);
                setCurrentOwnership(data.analysis.ownership_map || null);

                if (blackWinrate !== undefined && currentPly !== undefined) {
                    setAnalysisHistory(prev => ({
                        ...prev,
                        [currentPly]: { winrate: blackWinrate, scoreLead: blackScoreLead }
                    }));
                }
            }
        } catch (err) {
            console.error("Tutor analysis failed", err);
        }
    };

    const triggerBotMove = async (currentBoard, overrideGameId = null, passMove = null, overrideHistory = null) => {
        setIsBotThinking(true);
        console.log("[Katago] Triggering bot analysis request...");

        const blackStones = [];
        const whiteStones = [];
        const currentSize = currentBoard.length;

        for (let r = 0; r < currentSize; r++) {
            for (let c = 0; c < currentSize; c++) {
                if (currentBoard[r][c] === 'black') blackStones.push(toCoordinates(r, c, currentSize));
                if (currentBoard[r][c] === 'white') whiteStones.push(toCoordinates(r, c, currentSize));
            }
        }

        const payload = {
            ruleset: ruleset,
            komi: ruleset === 'chinese' ? 7.5 : 6.5,
            board_size: currentSize,
            black_stones: blackStones,
            white_stones: whiteStones,
            to_play: "W",
            move_number: moveCount + 1,
            bot_id: botId
            // Removed forced max visits since engine.py will naturally map botId to their safe speed threshold.
        };
        // We could theoretically pass `player_passed: true` here if the backend supports it, but KataGo stateless analysis mostly just needs the board.

        try {
            const res = await fetch(`${API_BASE_URL}/v1/games/analyze/stateless`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const data = await res.json();
            setIsBotThinking(false);

            let resultingBoard = currentBoard;

            if (data.status === "success" && data.result) {
                const actualResult = data.result?.result || data.result;
                let isWhite = payload.to_play === "W"; // Declare isWhite here
                const blackWinrate = isWhite ? (1 - actualResult.winrate) : actualResult.winrate;
                const blackScoreLead = isWhite ? -actualResult.scoreLead : actualResult.scoreLead;

                const targetIndex = overrideHistory ? overrideHistory.length : moveHistory.length;
                setAnalysisHistory(prev => ({
                    ...prev,
                    [targetIndex]: { winrate: blackWinrate, scoreLead: blackScoreLead }
                }));

                const moveStr = actualResult?.best_move;
                if (moveStr) {
                    const cleanMove = moveStr.toUpperCase();
                    if (cleanMove === "RESIGN") {
                        setMoveHistory(prev => [...prev, { m: prev.length + 1, c: 'RESIGN', p: 'w' }]);
                        setWinner('black_resign');
                        setGameState('finished');
                    } else if (cleanMove === "PASS") {
                        playSound('pass');
                        // Compile moves array directly from tracking refs if possible, otherwise use state
                        let currentMoves = overrideHistory || moveHistory;
                        if (passMove) {
                            currentMoves = [...(overrideHistory || moveHistory), { m: (overrideHistory || moveHistory).length + 1, c: 'PASS', p: currentPlayer.charAt(0) }];
                        }
                        boardHistoryListRef.current.push(JSON.stringify(currentBoard));
                        setMoveHistory(prev => {
                            const newHistory = [...prev, { m: prev.length + 1, c: 'PASS', p: 'w' }];
                            if (newHistory.length >= 2 && newHistory[newHistory.length - 2].c === 'PASS') {
                                const wScore = actualResult?.scoreLead || 0;
                                setWinner(wScore > 0 ? "white_points" : "black_points");
                                setGameState('finished');
                            }
                            return newHistory;
                        });
                    } else {
                        const parsed = parseKataGoMove(moveStr, currentSize);
                        if (parsed) {
                            const { r, c } = parsed;
                            const captureRes = applyGoRules(currentBoard, 'white', r, c, boardHistoryListRef.current);
                            if (captureRes) {
                                if (captureRes.capturedStones > 0) playSound('capture', captureRes.capturedStones);
                                else playSound('clack');
                                resultingBoard = captureRes.newBoard;
                                setBoard(captureRes.newBoard);
                                setCaptures(prev => ({ ...prev, white: prev.white + captureRes.capturedStones }));
                                setLastMove({ r, c });
                                boardHistoryListRef.current.push(JSON.stringify(captureRes.newBoard));
                                setMoveHistory(prev => [...prev, { m: prev.length + 1, c: moveStr.toUpperCase(), p: 'w' }]);
                            }
                        }
                    }
                }
            }
            handleTurnEnd('white');
            if (gameState !== 'finished') {
                setCurrentPlayer('black');
                const targetIndex = overrideHistory ? overrideHistory.length : moveHistory.length;
                requestTutorAnalysis(resultingBoard, 'black', targetIndex + 1); // Pass the officially registered white ply
            }

        } catch (err) {
            console.error("Bot analysis failed", err);
            setIsBotThinking(false);
            handleTurnEnd('white');
            setCurrentPlayer('black');
        }
    };

    // Interactive Analysis Mode: Map Ownership, Blunders, and PV Nodes
    useEffect(() => {
        if (gameState !== 'mistake_training' || !reviewMistakes[currentMistakeIndex]) return;

        const m = reviewMistakes[currentMistakeIndex];
        const newBoard = createEmptyBoard(boardSize);
        // Restore to exactly 1 move prior
        (m.state_before.black_stones || []).forEach((c: string) => {
            const parsed = parseKataGoMove(c, boardSize);
            if (parsed) newBoard[parsed.r][parsed.c] = 'black';
        });
        (m.state_before.white_stones || []).forEach((c: string) => {
            const parsed = parseKataGoMove(c, boardSize);
            if (parsed) newBoard[parsed.r][parsed.c] = 'white';
        });
        setMistakeTrainerBoard(newBoard);
        setTrainerFeedback(null);
        setTrainerAttemptCount(0);

        // Expose Analysis Telemetry Layers (Territory + PV Links)
        setCurrentOwnership(m.ownership || null);
        setShowTerritory(true);
        setRawHints(m.optimal_moves || []);
        setShowHints(true);
    }, [gameState, currentMistakeIndex, reviewMistakes, boardSize]);

    // Review Mode: Reconstruct board logic
    const displayBoard = React.useMemo(() => {
        if (gameState === 'mistake_training') return mistakeTrainerBoard || board;
        if (viewingMove === null) return board;

        // Time travel: rebuild board up to viewingMove
        let tempBoard = createEmptyBoard(boardSize);
        let tempHistory = [];
        for (let i = 0; i < viewingMove; i++) {
            const mv = moveHistory[i];
            if (mv && mv.c !== 'PASS' && mv.c !== 'RESIGN') {
                const parsed = parseKataGoMove(mv.c, boardSize);
                if (parsed) {
                    const color = mv.p === 'b' ? 'black' : 'white';
                    const res = applyGoRules(tempBoard, color, parsed.r, parsed.c, tempHistory);
                    if (res) {
                        tempBoard = res.newBoard;
                        tempHistory.push(JSON.stringify(tempBoard));
                    }
                }
            }
        }

        for (const mv of variationBranch) {
            if (mv && mv.c !== 'PASS') {
                const parsed = parseKataGoMove(mv.c, boardSize);
                if (parsed) {
                    const color = mv.p === 'b' ? 'black' : 'white';
                    const res = applyGoRules(tempBoard, color, parsed.r, parsed.c, tempHistory);
                    if (res) {
                        tempBoard = res.newBoard;
                        tempHistory.push(JSON.stringify(tempBoard));
                    }
                }
            }
        }
        return tempBoard;
    }, [gameState, mistakeTrainerBoard, viewingMove, board, moveHistory, boardSize, variationBranch]);


    const hints = React.useMemo(() => {
        if (!rawHints || rawHints.length === 0) return [];

        // 1. Identify context
        const playerColor = (gameState === 'finished' && viewingMove !== null)
            ? (viewingMove % 2 === 0 ? 'black' : 'white')
            : currentPlayer;

        const historySlice = (gameState === 'finished' && viewingMove !== null)
            ? boardHistoryListRef.current.slice(0, viewingMove + 1)
            : boardHistoryListRef.current;

        const activeBoard = gameState === 'finished' ? displayBoard : board;

        // 2. Filter legally unplayable moves (e.g. Ko Recapture)
        const legalHints = rawHints.filter(h => {
            if (h.move === 'PASS' || h.move === 'RESIGN') return false;
            const parsed = parseKataGoMove(h.move, boardSize);
            if (!parsed) return false;

            // Check against Go Physics rules
            const isLegal = applyGoRules(activeBoard, playerColor, parsed.r, parsed.c, historySlice);
            return !!isLegal;
        });

        const sortedHints = legalHints.sort((a, b) => {
            if (graphMode === 'winrate') {
                return (b.winrate || 0) - (a.winrate || 0);
            } else {
                return (b.scoreLead || 0) - (a.scoreLead || 0);
            }
        });
        if (sortedHints.length === 0) return [];

        if (hintStrategy === 'balanced') return sortedHints.slice(0, tuitionMode ? targetCandidates : 3);

        const getLineDepth = (r, c) => {
            const distTop = r + 1;
            const distBottom = boardSize - r;
            const distLeft = c + 1;
            const distRight = boardSize - c;
            return Math.min(distTop, distBottom, distLeft, distRight); // 1-indexed distance to edge
        };

        const isContact = (r, c) => {
            const neighbors = [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, 1], [-1, 1], [1, -1]];
            for (const [dr, dc] of neighbors) {
                const nr = r + dr;
                const nc = c + dc;
                if (nr >= 0 && nr < boardSize && nc >= 0 && nc < boardSize) {
                    if (activeBoard[nr][nc] !== null) return true;
                }
            }
            return false;
        };

        const bestScore = legalHints[0]?.scoreLead !== undefined ? legalHints[0].scoreLead : 0;

        const filtered = legalHints.filter(h => {
            // BLUNDER PREVENTION: Don't pick a "strategic" move if it's much worse than the absolute best move
            if (h.scoreLead !== undefined && Math.abs(bestScore - h.scoreLead) > 1.5) {
                return false;
            }

            const parsed = parseKataGoMove(h.move, boardSize);
            const depth = getLineDepth(parsed.r, parsed.c);

            if (hintStrategy === 'territory') return depth <= 3;
            if (hintStrategy === 'influence') return depth >= 4;
            if (hintStrategy === 'fighting') return isContact(parsed.r, parsed.c);
            return false;
        });

        if (filtered.length === 0) return legalHints.slice(0, 3);
        if (filtered.length < 3) {
            const backfill = legalHints.filter(h => !filtered.some(f => f.move === h.move)).slice(0, 3 - filtered.length);
            return [...filtered, ...backfill];
        }
        return filtered.slice(0, 3);
    }, [rawHints, hintStrategy, boardSize, board, displayBoard, gameState, viewingMove, currentPlayer]);

    // Auto-switch to review tab on game end
    useEffect(() => {
        if (gameState === 'finished') {
            setActiveTab('review');
        }
    }, [gameState]);

    // Clear variation branch when scrubbing main timeline
    useEffect(() => {
        setVariationBranch([]);
    }, [viewingMove]);

    // Review Mode: Fetch Historical Hints when Scrubbing
    useEffect(() => {
        if (gameState !== 'finished' || viewingMove === null) return;

        let isActive = true;
        setRawHints([]); // clear old hints while debouncing
        setCurrentOwnership(null);

        const handler = setTimeout(async () => {
            try {
                const reqBoard = displayBoard;
                const activeIndex = viewingMove + variationBranch.length;
                const playerToMove = activeIndex % 2 === 0 ? 'black' : 'white';

                const currentSize = reqBoard.length;
                const blackStones = [];
                const whiteStones = [];
                for (let r = 0; r < currentSize; r++) {
                    for (let c = 0; c < currentSize; c++) {
                        if (reqBoard[r][c] === 'black') blackStones.push(toCoordinates(r, c, currentSize));
                        if (reqBoard[r][c] === 'white') whiteStones.push(toCoordinates(r, c, currentSize));
                    }
                }

                const payload = {
                    ruleset: ruleset,
                    komi: ruleset === 'chinese' ? 7.5 : 6.5,
                    board_size: currentSize,
                    black_stones: blackStones,
                    white_stones: whiteStones,
                    to_play: playerToMove === 'black' ? 'B' : 'W',
                    bot_id: "analyzer", // Override scrubber to use deep deterministic evaluation
                    visits: 100 // Accelerated backend evaluation to prevent UI freezing during scrubs
                };

                const res = await fetch(`http://89.167.122.76:8000/v1/games/analyze/stateless`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });

                if (!res.ok) return;
                const data = await res.json();

                if (isActive && data.status === 'success' && data.result) {
                    const isWhite = payload.to_play === 'W';
                    const moveSource = (data.result.raw && data.result.raw.moveInfos) ? data.result.raw.moveInfos : (data.result.hints || []);
                    const parsedHints = moveSource.map(m => ({
                        move: m.move,
                        winrate: isWhite ? (1 - m.winrate) : m.winrate,
                        scoreLead: isWhite ? -m.scoreLead : m.scoreLead
                    }));
                    setRawHints(parsedHints);
                    setCurrentOwnership(data.result.ownership || null);
                }
            } catch (e) { console.error("Historical analysis err:", e); }
        }, 500);

        return () => {
            isActive = false;
            clearTimeout(handler);
        };
    }, [viewingMove, variationBranch, gameState, ruleset, botId, displayBoard]);

    // Move categorization logic dynamically scaled to board physics
    const getMoveQuality = (plyIndex) => {
        const mv = moveHistory[plyIndex - 1];
        if (!mv) return null;
        const prevEval = analysisHistory[plyIndex - 1];
        const currEval = analysisHistory[plyIndex];
        if (!prevEval || !currEval) return null;

        const deltaScore = currEval.scoreLead - prevEval.scoreLead;
        const colorFactor = mv.p === 'b' ? 1 : -1;
        const pointLoss = -(deltaScore * colorFactor);

        let winrateLoss = 0;
        if (mv.p === 'b') {
            winrateLoss = Math.max(0, prevEval.winrate - currEval.winrate);
        } else {
            winrateLoss = Math.max(0, currEval.winrate - prevEval.winrate);
        }

        const wrLoss = winrateLoss * 100;

        if (plyIndex === 5 || plyIndex === 9) {
            console.log(`[DEBUG QUALITY] plyIndex: ${plyIndex}, prevEval:`, prevEval, `currEval:`, currEval, `color:`, mv.p, `winrateLoss:`, winrateLoss, `wrLoss:`, wrLoss);
        }

        // Scale thresholds: If either winrate drop OR pure score loss exceeds safety margins, aggressively grade the move
        const isBlunder = wrLoss >= 20 || pointLoss >= 8.0;
        const isMistake = (wrLoss >= 10 || pointLoss >= 4.0) && !isBlunder;
        const isInaccuracy = (wrLoss >= 5 || pointLoss >= 2.0) && !isMistake && !isBlunder;
        const isGood = (wrLoss >= 2 || pointLoss >= 1.0) && !isInaccuracy && !isMistake && !isBlunder;

        if (isBlunder) return { label: 'Blunder', color: 'bg-red-500', delta: pointLoss };
        if (isMistake) return { label: 'Mistake', color: 'bg-orange-500', delta: pointLoss };
        if (isInaccuracy) return { label: 'Inaccuracy', color: 'bg-yellow-400', delta: pointLoss };
        if (isGood) return { label: 'Good', color: 'bg-green-400', delta: pointLoss };
        if (wrLoss >= 1 || pointLoss >= 0.5) return { label: 'Great', color: 'bg-emerald-500', delta: pointLoss };

        return { label: 'Excellent', color: 'bg-blue-500', delta: pointLoss };
    };

    // Calculate quality overlays for board rendering during review
    const qualityOverlays = useMemo(() => {
        if (gameState !== 'finished') return {};
        const overlays = {};
        const limit = viewingMove !== null ? viewingMove : moveHistory.length;

        for (let i = 1; i <= limit; i++) {
            const mv = moveHistory[i - 1];
            if (mv && mv.c !== 'PASS' && mv.c !== 'RESIGN') {
                const parsed = parseKataGoMove(mv.c, boardSize);
                if (parsed) {
                    const q = getMoveQuality(i);
                    if (q && (q.label === 'Mistake' || q.label === 'Blunder' || q.label === 'Inaccuracy')) {
                        overlays[`${parsed.r}-${parsed.c}`] = q;
                    } else if (q) {
                        overlays[`${parsed.r}-${parsed.c}`] = q;
                    }
                }
            }
        }
        return overlays;
    }, [gameState, viewingMove, moveHistory, analysisHistory, boardSize]);

    const matchStats = useMemo(() => {
        if (gameState !== 'finished') return null;
        const stats = {
            black: { Excellent: 0, Great: 0, Good: 0, Inaccuracy: 0, Mistake: 0, Blunder: 0, count: 0 },
            white: { Excellent: 0, Great: 0, Good: 0, Inaccuracy: 0, Mistake: 0, Blunder: 0, count: 0 }
        };

        for (let i = 1; i <= moveHistory.length; i++) {
            const mv = moveHistory[i - 1];
            const p = mv.p === 'b' ? 'black' : 'white';
            stats[p].count++;
            const q = getMoveQuality(i);
            if (!q) {
                stats[p].Excellent++;
                continue;
            }
            if (stats[p][q.label] !== undefined) {
                stats[p][q.label]++;
            }
        }
        return stats;
    }, [gameState, moveHistory, analysisHistory]);

    const handleIntersectionClick = async (row, col) => {
        if (gameState === 'mistake_training') {
            if (mistakeTrainerBoard[row][col] !== null || trainerFeedback?.type === 'success') return;

            const moveCoords = toCoordinates(row, col, boardSize);
            const m = reviewMistakes[currentMistakeIndex];
            const sortedHints = [...(m.optimal_moves || [])].sort((a: any, b: any) => (b.scoreLead || 0) - (a.scoreLead || 0));
            const bestHint = sortedHints[0];
            const isMatch = sortedHints.some((opt: any) =>
                opt.move === moveCoords &&
                (bestHint ? (bestHint.scoreLead - (opt.scoreLead || 0) < 1.5) : true)
            );

            // Show stone temporarily
            const newBoard = mistakeTrainerBoard.map((rowArr: any) => [...rowArr]);
            newBoard[row][col] = 'black';
            setMistakeTrainerBoard(newBoard);
            playSound('clack');

            if (isMatch) {
                setTrainerFeedback({ type: 'success', text: `Excellent! KataGo agrees this is the optimal move.` });
                playSound('capture');
            } else {
                setTrainerAttemptCount(p => p + 1);
                setTrainerFeedback({ type: 'error', text: `Inaccurate. Try to find the exact sequence KataGo recommends.` });
                // Revert after 1s
                setTimeout(() => {
                    if (gameState === 'mistake_training') {
                        const reverted = createEmptyBoard(boardSize);
                        (m.state_before.black_stones || []).forEach((c: string) => { const p = parseKataGoMove(c, boardSize); if (p) reverted[p.r][p.c] = 'black'; });
                        (m.state_before.white_stones || []).forEach((c: string) => { const p = parseKataGoMove(c, boardSize); if (p) reverted[p.r][p.c] = 'white'; });
                        setMistakeTrainerBoard(reverted);
                    }
                }, 1000);
            }
            return;
        }

        if (gameState === 'finished') {
            if (displayBoard[row][col] !== null) return;

            const colorIndex = (viewingMove !== null ? viewingMove : moveHistory.length) + variationBranch.length;
            const playerToMove = colorIndex % 2 === 0 ? 'black' : 'white';

            const result = applyGoRules(displayBoard, playerToMove, row, col, [JSON.stringify(displayBoard)]);
            if (!result) return;

            if (result.capturedStones > 0) playSound('capture', result.capturedStones);
            else playSound('clack');

            setVariationBranch(prev => [...prev, { m: colorIndex + 1, c: toCoordinates(row, col, boardSize), p: playerToMove === 'black' ? 'b' : 'w' }]);
            return;
        }

        console.log(`[Katago] Intersect click: ${row}, ${col}. Current state: isBotThinking=${isBotThinking}, currentPlayer=${currentPlayer}, boardSpot=${board[row][col]}`);
        if (board[row][col] !== null || isBotThinking || currentPlayer !== 'black') {
            console.log(`[Katago] Click blocked.`);
            return;
        }

        if (tuitionMode && gameState === 'playing') {
            const isAlreadyCandidate = tuitionCandidates.some(c => c.r === row && c.c === col);

            if (tuitionCandidates.length < targetCandidates) {
                if (isAlreadyCandidate) {
                    const filtered = tuitionCandidates.filter(c => c.r !== row || c.c !== col);
                    setTuitionCandidates(filtered);
                    if (showHints) setShowHints(false);
                    return;
                }
                const newCandidates = [...tuitionCandidates, { r: row, c: col }];
                setTuitionCandidates(newCandidates);
                if (newCandidates.length === targetCandidates) {
                    // Evaluate performance
                    const numMatches = newCandidates.filter(cand =>
                        hints.some(h => h.move === toCoordinates(cand.r, cand.c, boardSize))
                    ).length;

                    if (numMatches > 0) {
                        setTuitionScore(prev => prev + numMatches);
                    }
                    setShowHints(true);
                }
                return;
            }

            // Reaching here implies they clicked specifically to submit a final move after seeing the answers
            setTuitionCandidates([]);
            setShowHints(false);
        }

        const result = applyGoRules(board, 'black', row, col, boardHistoryListRef.current);
        if (!result) {
            console.log(`[Katago] Invalid move by Go rules.`);
            return;
        }

        if (result.capturedStones > 0) playSound('capture', result.capturedStones);
        else playSound('clack');

        const newBoard = result.newBoard;
        setBoard(newBoard);
        setRawHints([]);
        setCaptures(prev => ({ ...prev, black: prev.black + result.capturedStones }));
        setLastMove({ r: row, c: col });
        boardHistoryListRef.current.push(JSON.stringify(newBoard));

        const updatedHistory = [...moveHistory, { m: moveHistory.length + 1, c: toCoordinates(row, col, boardSize), p: 'b' }];
        setMoveHistory(updatedHistory);
        setMoveCount(prev => prev + 1);
        handleTurnEnd('black');
        setCurrentPlayer('white');

        triggerBotMove(result.newBoard, null, false, updatedHistory);
    };

    // --- RENDER HELPERS --- //
    const getHoshiPoints = () => {
        if (boardSize === 19) return [[3, 3], [3, 9], [3, 15], [9, 3], [9, 9], [9, 15], [15, 3], [15, 9], [15, 15]];
        if (boardSize === 13) return [[3, 3], [3, 9], [6, 6], [9, 3], [9, 9]];
        if (boardSize === 9) return [[2, 2], [2, 6], [4, 4], [6, 2], [6, 6]];
        return [];
    };

    const getHoverColor = () => {
        if (gameState === 'playing' && currentPlayer === 'black') return 'black';
        if (gameState === 'finished') {
            const index = (viewingMove !== null ? viewingMove : moveHistory.length) + variationBranch.length;
            return index % 2 === 0 ? 'black' : 'white';
        }
        return null;
    };
    const hoverColor = getHoverColor();

    let lastMoveCoords = null;
    if (gameState === 'finished') {
        const viewingIndex = (viewingMove !== null ? viewingMove : moveHistory.length) + variationBranch.length;
        if (viewingIndex > 0) {
            const lastMv = variationBranch.length > 0 ? variationBranch[variationBranch.length - 1] : moveHistory[viewingIndex - 1];
            if (lastMv && lastMv.c !== 'PASS' && lastMv.c !== 'RESIGN') {
                lastMoveCoords = parseKataGoMove(lastMv.c, boardSize);
            }
        }
    } else if (gameState === 'mistake_training') {
        const m = reviewMistakes[currentMistakeIndex];
        if (m && m.state_before && m.state_before.last_move && m.state_before.last_move !== 'PASS' && m.state_before.last_move !== 'RESIGN') {
            lastMoveCoords = parseKataGoMove(m.state_before.last_move, boardSize);
        }
    } else if (gameState === 'playing') {
        if (lastMove) {
            lastMoveCoords = lastMove;
        }
    }

    return (
        // bg-[#FDFCF9] page background with hidden overflow for off-screen sliding lids
        <div className="min-h-[100dvh] bg-[#FDFCF9] text-gray-900 font-sans flex flex-col items-center justify-center pt-[80px] pb-[40px] px-4 relative overflow-x-hidden">
            <Head>
                <title>Play Go | Online-Go</title>
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
            </Head>

            {/* THEATER MODE OVERLAY */}
            <div
                className={`fixed inset-0 pointer-events-none transition-colors duration-[2500ms] ease-out z-0 ${(gameState === 'playing' || gameState === 'mistake_training') ? 'bg-neutral-950/85' : 'bg-transparent'}`}
            />

            {/* Container centered, max-width 1920px */}
            <div className="w-full max-w-[1920px] flex flex-col items-center justify-center relative z-10 flex-1">
                {/* Header block removed to maximize scaling space */}

                {/* 3 Zones Layout Component Area */}
                <main className="w-full flex flex-col xl:flex-row gap-[24px] justify-center items-center">

                    {/* Компонент 3: Карточка Игрока (Слева) */}
                    <div className={`w-full flex xl:flex-col gap-[24px] shrink-0 order-2 xl:order-1 pt-4 transition-all duration-1000 ${gameState === 'finished' ? 'hidden' : ''} ${gameState === 'playing' ? 'xl:w-[260px]' : 'xl:w-[200px]'}`}>

                        {/* KataGo Card */}
                        <div className={`flex-1 xl:flex-none backdrop-blur-[30px] rounded-[32px] p-[24px] flex flex-col items-center relative isolation-auto transition-all duration-1000 ease-out hover:-translate-y-[2px] bg-[linear-gradient(160deg,rgba(70,55,40,0.55),rgba(25,22,18,0.45))] border border-white/[0.12] ${currentPlayer === 'white' && gameState === 'playing' ? 'ring-1 ring-[#d9a35f]/40 shadow-[0_40px_90px_rgba(0,0,0,0.55),_inset_0_1px_0_rgba(255,255,255,0.18),_0_0_24px_rgba(217,163,95,0.18)] scale-[1.01]' : 'shadow-[0_40px_90px_rgba(0,0,0,0.55),_inset_0_1px_0_rgba(255,255,255,0.18),_inset_0_-1px_0_rgba(0,0,0,0.2)] scale-100'}`}>
                            {/* Glass thickness internal rim */}
                            <div className="absolute inset-0 pointer-events-none rounded-[32px] z-0" style={{ boxShadow: "inset 0 2px 6px rgba(255,255,255,0.12), inset 0 -6px 20px rgba(0,0,0,0.35)" }} />
                            {/* Inner highlight */}
                            <div className="absolute inset-0 rounded-[32px] pointer-events-none z-0" style={{ background: 'radial-gradient(circle at 50% 15%, rgba(255,210,150,0.08), transparent 60%)' }} />

                            <div className="relative z-10 flex flex-col items-center w-full">
                                <div className={`w-[72px] h-[72px] rounded-full flex items-center justify-center mb-4 transition-all duration-1000 bg-gradient-to-b from-[rgba(255,255,255,0.1)] to-[rgba(255,255,255,0.02)] border border-white/10 shadow-[inset_0_2px_6px_rgba(255,255,255,0.2),_0_4px_12px_rgba(0,0,0,0.3)]`}>
                                    <Cpu className="w-9 h-9 text-[#d9a35f]" />
                                </div>
                                <div className="font-black text-white/90 text-[18px] tracking-tight mb-0.5">{BOT_PROFILES.find(b => b.id === botId)?.label || 'KataGo'}</div>
                                <div className="text-[12px] text-white/50 font-bold tracking-[0.08em] uppercase mb-5">{BOT_PROFILES.find(b => b.id === botId)?.style || 'AI'} • {BOT_PROFILES.find(b => b.id === botId)?.rank || 'AI'}</div>

                                <div className="w-full border-t border-white/10 pt-5 mb-4 flex justify-between items-center px-1">
                                    <span className="text-[11px] uppercase font-bold text-white/50 tracking-widest flex items-center gap-2">Captures <div className="w-2.5 h-2.5 rounded-full bg-[rgba(255,255,255,0.9)] shadow-[0_0_4px_rgba(255,255,255,0.5)] border border-white/20"></div></span>
                                    <span className="text-[16px] font-black text-white/90">{captures.white}</span>
                                </div>

                                <div className={`text-[42px] font-black tracking-tighter leading-none mb-1 transition-colors duration-1000 [text-shadow:0_2px_10px_rgba(0,0,0,0.3)] ${(whiteTime.inByoyomi || whiteTime.main < 30) ? 'text-[#d9a35f]' : 'text-white/90'}`}>
                                    {formatCurrentTime(whiteTime)}
                                </div>
                                <div className="text-[13px] font-bold text-white/40 tracking-[0.08em] mb-3 uppercase">
                                    + {formatPeriods(whiteTime)}
                                </div>

                                <div className="mt-2 h-[24px]">
                                    {currentPlayer === 'white' && gameState === 'playing' ? (
                                        <div className="bg-[linear-gradient(180deg,rgba(255,225,188,0.95),rgba(255,206,152,0.82))] border border-[rgba(195,138,74,0.38)] shadow-[0_4px_12px_rgba(193,132,68,0.22),_inset_0_1px_0_rgba(255,255,255,0.6)] text-[#1E1C19] text-[10px] font-black uppercase tracking-widest px-4 py-1.5 rounded-full">
                                            Thinking
                                        </div>
                                    ) : null}
                                </div>
                            </div>
                        </div>

                        {/* Player Card */}
                        <div className={`flex-1 xl:flex-none backdrop-blur-[30px] rounded-[32px] p-[24px] flex flex-col items-center relative isolation-auto transition-all duration-1000 ease-out hover:-translate-y-[2px] bg-[linear-gradient(160deg,rgba(70,55,40,0.55),rgba(25,22,18,0.45))] border border-white/[0.12] ${currentPlayer === 'black' && gameState === 'playing' ? 'ring-1 ring-[#d9a35f]/40 shadow-[0_40px_90px_rgba(0,0,0,0.55),_inset_0_1px_0_rgba(255,255,255,0.18),_0_0_24px_rgba(217,163,95,0.18)] scale-[1.01]' : 'shadow-[0_40px_90px_rgba(0,0,0,0.55),_inset_0_1px_0_rgba(255,255,255,0.18),_inset_0_-1px_0_rgba(0,0,0,0.2)] scale-100'}`}>
                            {/* Glass thickness internal rim */}
                            <div className="absolute inset-0 pointer-events-none rounded-[32px] z-0" style={{ boxShadow: "inset 0 2px 6px rgba(255,255,255,0.12), inset 0 -6px 20px rgba(0,0,0,0.35)" }} />
                            {/* Inner highlight */}
                            <div className="absolute inset-0 rounded-[32px] pointer-events-none z-0" style={{ background: 'radial-gradient(circle at 50% 15%, rgba(255,210,150,0.08), transparent 60%)' }} />

                            <div className="relative z-10 flex flex-col items-center w-full">
                                <div className="w-[72px] h-[72px] rounded-full flex items-center justify-center mb-4 transition-all duration-1000 bg-gradient-to-b from-[#2A2621] to-[#1E1C19] border border-white/10 shadow-[0_8px_16px_rgba(0,0,0,0.4),_inset_0_2px_4px_rgba(255,255,255,0.08)]">
                                    <User className="w-8 h-8 text-[#EBE5DF]" />
                                </div>
                                <div className="font-black text-white/90 text-[18px] tracking-tight mb-0.5">{user?.username || 'You'}</div>
                                <div className="text-[12px] text-white/50 font-bold tracking-[0.08em] uppercase mb-5">{user?.rank || '25k'}</div>

                                <div className="w-full border-t border-white/10 pt-5 mb-4 flex justify-between items-center px-1">
                                    <span className="text-[11px] uppercase font-bold text-white/50 tracking-widest flex items-center gap-2">Captures <div className="w-2.5 h-2.5 rounded-full bg-[rgba(30,28,25,0.9)] shadow-[0_0_6px_rgba(0,0,0,0.8),_inset_0_1px_2px_rgba(255,255,255,0.2)] border border-black/40"></div></span>
                                    <span className="text-[16px] font-black text-white/90">{captures.black}</span>
                                </div>

                                <div className={`text-[42px] font-black tracking-tighter leading-none mb-1 transition-colors duration-1000 [text-shadow:0_2px_10px_rgba(0,0,0,0.3)] ${(blackTime.inByoyomi || blackTime.main < 30) ? 'text-[#d9a35f]' : 'text-white/90'}`}>
                                    {formatCurrentTime(blackTime)}
                                </div>
                                <div className="text-[13px] font-bold text-white/40 tracking-[0.08em] mb-3 uppercase">
                                    + {formatPeriods(blackTime)}
                                </div>

                                <div className="mt-2 h-[24px]">
                                    {currentPlayer === 'black' && gameState === 'playing' ? (
                                        <div className="bg-[linear-gradient(180deg,#1a1a1a,#0f0f0f)] shadow-[0_10px_24px_rgba(0,0,0,0.35),_inset_0_1px_0_rgba(255,255,255,0.08)] text-[#F4F0EC] text-[10px] font-black uppercase tracking-widest px-4 py-1.5 rounded-full">
                                            Your Turn
                                        </div>
                                    ) : null}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* ЦЕНТР: Компонент 2 — Доска + Компонент 4 — Панель Действий */}
                    <div className="flex-1 flex flex-col items-center justify-center shrink-0 min-w-[300px] w-full xl:max-w-[70vw] order-1 xl:order-2 gap-[24px] z-20 overflow-visible xl:px-4">
                        <div className="w-full flex items-center justify-center relative my-2 sm:my-4">

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


                            {/* Actual unified abstract game engine GoBoard component */}
                            <GoBoard
                                boardSize={boardSize}
                                boardPx={boardPx}
                                displayBoard={displayBoard}
                                onIntersectionClick={handleIntersectionClick}
                                hoverColor={hoverColor}
                                lastMoveCoords={lastMoveCoords}
                                showTerritory={showTerritory}
                                currentOwnership={currentOwnership}
                                showHints={showHints}
                                hints={hints}
                                graphMode={graphMode as any}
                                gameState={gameState as any}
                                expandedMistake={expandedMistake}
                                reviewMistakes={reviewMistakes}
                                currentMistakeIndex={currentMistakeIndex}
                                variationBranch={variationBranch}
                                viewingMove={viewingMove}
                                tuitionMode={tuitionMode}
                                tuitionCandidates={tuitionCandidates}
                            />
                        </div>

                        {/* Компонент 4 — Панель действий */}
                        {
                            gameState === 'finished' && (variationBranch.length > 0 || typeof viewingMove === 'number') && (
                                <div className="mt-[16px] h-[48px] bg-[#4CAF84] rounded-[12px] w-full flex items-center justify-center cursor-pointer hover:bg-[#439c76] shadow-[0_4px_12px_rgba(76,175,132,0.3)] transition-colors relative z-40" style={{ maxWidth: boardPx }} onClick={() => { setVariationBranch([]); setViewingMove(null); }}>
                                    <span className="font-bold text-white tracking-wide text-[14px]">Return to the Match</span>
                                </div>
                            )
                        }
                        {
                            gameState !== 'finished' && (
                                <div className="mt-[20px] h-[72px] sm:h-[80px] theater-glass-panel rounded-[24px] w-full flex items-center justify-between py-[12px] px-[20px] sm:px-[24px] shrink-0 relative z-40 transition-all duration-[2500ms]" style={{ maxWidth: boardPx }}>

                                    {/* Action Buttons */}
                                    <div className="flex gap-[16px] items-center shrink-0">
                                        <button onClick={handlePass} className="h-[56px] sm:h-[60px] px-[20px] sm:px-[24px] rounded-full bg-[rgba(106,168,138,0.16)] border border-[rgba(106,168,138,0.14)] text-[#4DAA7F] font-semibold text-[16px] sm:text-[18px] inline-flex items-center gap-[12px] transition-all duration-200 ease-out hover:-translate-y-[1px] active:scale-[0.985]">
                                            <div className="w-[10px] h-[10px] rounded-full bg-[#4DAA7F] shadow-[0_2px_4px_rgba(77,170,127,0.3)]"></div> <span className="hidden sm:inline">Pass</span>
                                        </button>
                                        <button onClick={handleResign} className="h-[56px] sm:h-[60px] px-[20px] sm:px-[24px] rounded-full bg-[rgba(214,126,126,0.16)] border border-[rgba(214,126,126,0.12)] text-[#DC6E63] font-semibold text-[16px] sm:text-[18px] inline-flex items-center gap-[12px] transition-all duration-200 ease-out hover:-translate-y-[1px] active:scale-[0.985]">
                                            <Flag className="w-[18px] sm:w-[20px] h-[18px] sm:h-[20px] shrink-0" strokeWidth={1.5} /> <span className="hidden sm:inline">Resign</span>
                                        </button>
                                    </div>

                                    {/* Navigation */}
                                    <div className="flex items-center gap-[12px] sm:gap-[24px] shrink-0">
                                        <button disabled={viewingMove === 0} onClick={() => setViewingMove(0)} className="bg-transparent border-none text-[20px] sm:text-[22px] font-semibold text-[#9EA4B2] hover:text-[#6F7685] hover:bg-[rgba(20,30,50,0.04)] disabled:text-[rgba(158,164,178,0.35)] disabled:bg-transparent disabled:pointer-events-none px-[8px] py-[6px] rounded-[12px] transition-all duration-200 active:scale-[0.96] hidden sm:block">&lt;&lt;</button>
                                        <button disabled={viewingMove === 0} onClick={() => setViewingMove(viewingMove !== null ? Math.max(0, viewingMove - 1) : Math.max(0, moveHistory.length - 1))} className="bg-transparent border-none text-[20px] sm:text-[22px] font-semibold text-[#9EA4B2] hover:text-[#6F7685] hover:bg-[rgba(20,30,50,0.04)] disabled:text-[rgba(158,164,178,0.35)] disabled:bg-transparent disabled:pointer-events-none px-[8px] py-[6px] rounded-[12px] transition-all duration-200 active:scale-[0.96]">&lt;</button>

                                        <span className="font-semibold text-gray-900 min-w-[50px] text-center text-[16px] sm:text-[18px] tabular-nums tracking-wide">{viewingMove !== null ? viewingMove : moveHistory.length} <span className="text-[rgba(158,164,178,0.7)] ml-1">/ {moveHistory.length}</span></span>

                                        <button disabled={viewingMove === null || viewingMove === moveHistory.length} onClick={() => setViewingMove(viewingMove !== null ? (viewingMove + 1 >= moveHistory.length ? null : viewingMove + 1) : null)} className="bg-transparent border-none text-[20px] sm:text-[22px] font-semibold text-[#9EA4B2] hover:text-[#6F7685] hover:bg-[rgba(20,30,50,0.04)] disabled:text-[rgba(158,164,178,0.35)] disabled:bg-transparent disabled:pointer-events-none px-[8px] py-[6px] rounded-[12px] transition-all duration-200 active:scale-[0.96]">&gt;</button>
                                        <button disabled={viewingMove === null || viewingMove === moveHistory.length} onClick={() => setViewingMove(null)} className="bg-transparent border-none text-[20px] sm:text-[22px] font-semibold text-[#9EA4B2] hover:text-[#6F7685] hover:bg-[rgba(20,30,50,0.04)] disabled:text-[rgba(158,164,178,0.35)] disabled:bg-transparent disabled:pointer-events-none px-[8px] py-[6px] rounded-[12px] transition-all duration-200 active:scale-[0.96] hidden sm:block">&gt;&gt;</button>
                                    </div>

                                </div>
                            )
                        }

                        {/* Center Column Ends Here */}
                    </div >

                    {/* ПРАВАЯ ПАНЕЛЬ: Компонент 5 */}
                    < div
                        className={`fixed right-0 top-1/2 -translate-y-1/2 z-50 cursor-pointer group flex items-center shadow-[-5px_0_20px_rgba(0,0,0,0.15)] hover:scale-[1.03] transition-all duration-[800ms] ease-[cubic-bezier(0.4,0,0.2,1)] ${showAnalysis ? 'translate-x-[150%] opacity-0 pointer-events-none' : 'translate-x-[0px] opacity-100'}`
                        }
                        onClick={() => setShowAnalysis(true)}
                    >
                        <div className="bg-[#1A1A1A]/90 backdrop-blur-md text-[#D4B595] px-2.5 py-8 rounded-l-[16px] uppercase tracking-[0.2em] text-[12px] font-bold border border-[#333] border-r-0 hover:text-white transition-colors [writing-mode:vertical-rl] rotate-180 flex items-center gap-3">
                            <LineChart className="w-4 h-4 rotate-90" />
                            ANALYSIS
                        </div>
                    </div >

                    <div className={`z-30 pt-[10px] hidden xl:flex flex-col shrink-0 transition-all duration-[800ms] ease-[cubic-bezier(0.4,0,0.2,1)] overflow-visible order-3 ${showAnalysis ? ((gameState === 'finished' || gameState === 'mistake_training') ? 'w-[420px] opacity-100' : 'w-[280px] opacity-100') : (gameState === 'playing' ? 'w-[260px] opacity-0 pointer-events-none' : 'w-[200px] opacity-0 pointer-events-none')}`}>
                        <div className={`w-full ${(gameState === 'finished' || gameState === 'mistake_training') ? 'xl:w-[420px]' : 'xl:w-[280px]'} bg-gradient-to-b from-white/80 to-[#F4F0EC]/92 backdrop-blur-[16px] border border-white/35 rounded-[28px] shadow-[0_24px_60px_rgba(25,18,12,0.12),_0_8px_24px_rgba(25,18,12,0.08),_inset_0_1px_0_rgba(255,255,255,0.7)] p-[24px] flex flex-col shrink-0 h-[760px] min-h-[760px] max-h-[760px] relative overflow-hidden z-20`}>
                            <div className="absolute inset-0 rounded-[28px] pointer-events-none z-0" style={{ background: 'radial-gradient(circle at 25% 18%, rgba(255,210,150,0.22), transparent 45%), radial-gradient(circle at 72% 14%, rgba(255,235,210,0.10), transparent 48%)' }} />

                            {/* GLOBAL HEADER ROW */}
                            <div className="flex items-center gap-2 mb-5 shrink-0 relative z-50">
                                {/* CLOSE BUTTON */}
                                <button
                                    onClick={() => setShowAnalysis(false)}
                                    className="w-8 h-8 flex items-center justify-center rounded-[10px] text-[#948C83] hover:text-[#3A342E] hover:bg-white/60 transition-colors shrink-0 -ml-1"
                                >
                                    <X className="w-5 h-5" />
                                </button>

                                {/* MATCH INFO */}
                                {gameState !== 'mistake_training' && (
                                    <div className="flex flex-col ml-1">
                                        <div className="text-[15px] font-bold text-[#1E1C19] tracking-tight leading-tight">Unranked Match</div>
                                        <div className="text-[10px] text-[#948C83] font-bold tracking-widest uppercase mt-0.5">{boardSize}x{boardSize} • {ruleset === 'japanese' ? 'Japanese' : 'Chinese'}</div>
                                    </div>
                                )}
                            </div>

                            {gameState === 'mistake_training' ? (
                                <div className="flex flex-col h-full overflow-y-auto custom-scrollbar pr-1 gap-4 relative z-10">
                                    <div className="text-[13px] uppercase font-bold text-[#6E675F] tracking-widest flex items-center gap-2 border-b border-[#503C28]/10 pb-3">
                                        <Activity className="w-4 h-4 text-[#C38A4A]" /> Mistake Trainer
                                    </div>

                                    {reviewMistakes[currentMistakeIndex] && (
                                        <div className="flex flex-col gap-4">
                                            <div className="bg-red-50 border border-red-100 rounded-[12px] p-4">
                                                <div className="text-[13px] font-bold text-red-600 mb-1">
                                                    Turn {reviewMistakes[currentMistakeIndex].turn} • {reviewMistakes[currentMistakeIndex].type === 'blunder' ? 'Critical Blunder' : 'Mistake'}
                                                </div>
                                                <div className="text-[14px] text-gray-800 font-medium">
                                                    You played <span className="font-bold">{reviewMistakes[currentMistakeIndex].played_move}</span> and lost <span className="font-bold text-red-500">{reviewMistakes[currentMistakeIndex].score_drop.toFixed(1)}</span> pts.
                                                </div>
                                                <div className="text-[12px] text-gray-500 mt-2">
                                                    {reviewMistakes[currentMistakeIndex].is_ai_generated
                                                        ? reviewMistakes[currentMistakeIndex].concept_explanation
                                                        : "KataGo identified this as a critical turning point. Can you spot the correct sequence?"}
                                                </div>
                                            </div>

                                            {/* Dynamic Hint Options (Always Visible per ТЗ) */}
                                            <div className="bg-[#FAF8F5]/50 border border-[#503C28]/10 rounded-[12px] p-4 text-[13px] shadow-[inset_0_1px_0_rgba(255,255,255,0.6),_0_8px_20px_rgba(30,20,10,0.05)] relative overflow-hidden mt-2">
                                                <div className="font-bold text-[#3A342E] mb-3 flex items-center gap-2 tracking-wide uppercase text-[11px]">
                                                    <Cpu className="w-3.5 h-3.5" /> KataGo Top Options
                                                </div>
                                                <div className="flex flex-col gap-2 font-mono text-[#3A342E]">
                                                    {(() => {
                                                        const m = reviewMistakes[currentMistakeIndex];
                                                        const sorted = [...(m.optimal_moves || [])].sort((a: any, b: any) => (b.scoreLead || 0) - (a.scoreLead || 0));
                                                        return sorted.slice(0, 5).map((opt: any, i: number) => (
                                                            <div key={i} className="flex justify-between items-center bg-white/70 border border-[#503C28]/10 px-3 py-2 rounded-[8px] shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]">
                                                                <div className="flex items-center gap-2">
                                                                    <span className={`font-black px-1.5 py-0.5 rounded-[6px] text-[11px] ${i === 0 ? 'bg-[#FFE1BC]/90 text-[#3A342E] shadow-[0_2px_8px_rgba(193,132,68,0.2)]' : 'bg-transparent border border-[#503C28]/15 text-[#6E675F]'}`}>
                                                                        {i === 0 ? 'BEST MOVE' : `#${i + 1}`}
                                                                    </span>
                                                                    <span className="font-bold text-[14px] w-8">{opt.move}</span>
                                                                </div>
                                                                <div className="text-[12px]">
                                                                    <span className="text-[#948C83] font-medium">Score:</span> <span className="font-bold text-[#d9a35f]">{opt.scoreLead > 0 ? '+' : ''}{opt.scoreLead ? opt.scoreLead.toFixed(1) : 0} pts</span>
                                                                </div>
                                                            </div>
                                                        ));
                                                    })()}
                                                </div>

                                                {/* Actual Performed Move */}
                                                <div className="mt-4 pt-4 border-t border-[#503C28]/10">
                                                    <div className="font-bold text-[#3A342E] mb-2 flex items-center gap-2 tracking-wide uppercase text-[11px]">
                                                        <Activity className="w-3.5 h-3.5" /> Your Move
                                                    </div>
                                                    <div className="flex justify-between items-center bg-red-50 border border-red-200 px-3 py-2 rounded-[8px] shadow-sm font-mono">
                                                        <div className="flex items-center gap-2">
                                                            <span className="font-black bg-red-500 text-white px-1.5 py-0.5 rounded text-[11px] shadow-sm">
                                                                MISTAKE
                                                            </span>
                                                            <span className="font-bold text-[14px] text-red-900 w-8">{reviewMistakes[currentMistakeIndex].played_move}</span>
                                                        </div>
                                                        <div className="text-[12px]">
                                                            <span className="text-red-400 font-medium">Lost:</span> <span className="font-bold text-red-700">{Math.abs(reviewMistakes[currentMistakeIndex].score_drop || 0).toFixed(1)} pts</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

                                            <button
                                                onClick={handleGenerateTsumego}
                                                disabled={isGeneratingTsumego}
                                                className="w-full py-2.5 bg-white/50 hover:bg-white text-[#3A342E] font-bold rounded-[14px] text-[13px] transition-colors border border-[#503C28]/15 shadow-[0_4px_12px_rgba(30,20,10,0.04)] flex items-center justify-center gap-2 disabled:opacity-50 mt-2"
                                            >
                                                {isGeneratingTsumego ? (
                                                    <><div className="w-4 h-4 border-2 border-[#503C28]/30 border-t-[#503C28] rounded-full animate-spin"></div> Synthesizing...</>
                                                ) : (
                                                    <>🧠 Generate Similar Tsumego</>
                                                )}
                                            </button>

                                            {/* Sandbox Action Controls */}
                                            <div className="flex gap-2.5 mt-2">
                                                <button
                                                    onClick={handleTrainerUndo}
                                                    className="w-full py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-[10px] text-[13px] transition-colors shadow-sm flex items-center justify-center gap-1.5 border border-gray-200"
                                                >
                                                    <Undo2 className="w-4 h-4" /> Undo Move
                                                </button>
                                            </div>

                                            {trainerFeedback && (
                                                <div className={`p-4 rounded-[16px] shadow-[inset_0_1px_0_rgba(255,255,255,0.7)] border ${trainerFeedback.type === 'success' ? 'bg-[#F4F0EC]/90 border-[#503C28]/15 text-[#3A342E]' : trainerFeedback.type === 'error' ? 'bg-orange-50/80 border-orange-200 text-orange-800' : 'bg-white/80 border-[#503C28]/10 text-[#3A342E]'}`}>
                                                    <div className="text-[14px] font-bold leading-snug">{trainerFeedback.text}</div>
                                                </div>
                                            )}

                                            <div className="mt-auto flex gap-3 pt-6">
                                                <button onClick={() => {
                                                    if (currentMistakeIndex > 0) setCurrentMistakeIndex(p => p - 1);
                                                }} disabled={currentMistakeIndex === 0} className="flex-1 py-3 bg-white/70 hover:bg-white text-[#6E675F] hover:text-[#3A342E] font-bold rounded-[14px] transition-colors border border-[#503C28]/10 shadow-[0_4px_12px_rgba(30,20,10,0.04)] disabled:opacity-50">
                                                    &lt; Previous
                                                </button>

                                                {currentMistakeIndex < reviewMistakes.length - 1 ? (
                                                    <button onClick={() => {
                                                        setCurrentMistakeIndex(p => p + 1);
                                                    }} className={`flex-[2] py-3 text-[#1E1C19] border border-[#C38A4A]/30 font-bold rounded-[14px] transition-colors shadow-[0_8px_20px_rgba(193,132,68,0.15)] ${trainerFeedback?.type === 'success' ? 'bg-gradient-to-b from-[#F4F0EC] to-[#EBE5DF] text-[#3A342E] border-[#503C28]/20 shadow-[0_6px_16px_rgba(30,20,10,0.06)]' : 'bg-gradient-to-b from-[#FFE1BC]/90 to-[#FFCE98]/80'}`}>
                                                        Next Mistake &gt;
                                                    </button>
                                                ) : (
                                                    <button onClick={() => {
                                                        setGameState('finished');
                                                    }} className={`flex-[2] py-3 font-bold rounded-[14px] transition-colors shadow-[0_8px_20px_rgba(30,20,10,0.15)] ${trainerFeedback?.type === 'success' ? 'bg-gradient-to-b from-[#F4F0EC] to-[#EBE5DF] text-[#3A342E] border border-[#503C28]/20 shadow-[0_6px_16px_rgba(30,20,10,0.06)]' : 'bg-[#1E1C19] text-white hover:bg-[#3A342E]'}`}>
                                                        Finish Review
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ) : gameState === 'finished' ? (
                                <div className="flex flex-col h-full overflow-y-auto custom-scrollbar pr-1 gap-4">
                                    {/* PLAYER COMPACT CARDS */}
                                    <div className="flex bg-gray-50 border border-gray-100 rounded-[12px] p-2 gap-2 shrink-0">
                                        <div className="flex-1 flex flex-col items-center justify-center bg-white rounded-[8px] p-2 shadow-sm border border-gray-100">
                                            <div className="flex items-center gap-2 mb-1">
                                                <div className="w-5 h-5 bg-[#1A1A1A] rounded flex items-center justify-center shrink-0">
                                                    <User className="w-3 h-3 text-white" />
                                                </div>
                                                <div className="text-[13px] font-bold text-gray-900 leading-tight">{user?.username || 'You'} <span className="text-[10px] text-gray-400 font-normal">{user?.rank || '25k'}</span></div>
                                            </div>
                                            <div className="text-[18px] font-black">{captures.black} <span className="text-[10px] font-bold text-gray-400 uppercase">captures</span></div>
                                        </div>
                                        <div className="flex-1 flex flex-col items-center justify-center bg-white rounded-[8px] p-2 shadow-sm border border-gray-100">
                                            <div className="flex items-center gap-2 mb-1">
                                                <div className="w-5 h-5 bg-[#E5F1EB] rounded flex items-center justify-center shrink-0">
                                                    <Cpu className="w-3 h-3 text-[#4CAF84]" />
                                                </div>
                                                <div className="text-[13px] font-bold text-gray-900 leading-tight capitalize">{BOT_PROFILES.find(b => b.id === botId)?.label || 'KataGo'} <span className="text-[10px] text-gray-400 font-normal">{BOT_PROFILES.find(b => b.id === botId)?.rank || 'AI'}</span></div>
                                            </div>
                                            <div className="text-[18px] font-black">{captures.white} <span className="text-[10px] font-bold text-gray-400 uppercase">captures</span></div>
                                        </div>
                                    </div>
                                    <div className="text-[11px] text-gray-400 text-center uppercase tracking-wider font-bold -mt-2 mb-2">Unranked • {ruleset === 'japanese' ? 'Japanese Rules' : 'Chinese Rules'}</div>

                                    {tuitionScore > 0 && (
                                        <div className="flex bg-[#FAF8F5]/80 border border-[#503C28]/10 rounded-[16px] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.6),_0_8px_20px_rgba(30,20,10,0.05)] items-center justify-between text-[#3A342E] shrink-0 mb-2 relative overflow-hidden">
                                            <div className="absolute inset-0 bg-gradient-to-r from-[#FFE1BC]/20 to-transparent pointer-events-none" />
                                            <div className="flex flex-col gap-1 relative z-10">
                                                <div className="flex gap-2 items-center">
                                                    <GraduationCap className="w-5 h-5 text-[#d9a35f]" />
                                                    <span className="font-bold text-[13px]">Tuition Mode Training</span>
                                                </div>
                                                <div className="text-[10px] text-[#948C83] uppercase font-bold tracking-widest pl-7">Lifetime: {(() => { try { return parseInt(localStorage.getItem('katago_tuition_score') || '0', 10) + tuitionScore } catch { return tuitionScore } })()} PT</div>
                                            </div>
                                            <div className="font-black text-[22px] text-[#d9a35f] relative z-10">+{tuitionScore} PT</div>
                                        </div>
                                    )}

                                    {/* TRAINING SUGGESTIONS TABLE (Moved to top layer UX) */}
                                    {reviewMistakes.length > 0 && (
                                        <div className="w-full bg-red-50/40 border border-red-100 rounded-[12px] p-3 shrink-0 shadow-[0_4px_12px_rgba(239,68,68,0.05)]">
                                            <div className="flex items-center gap-2 mb-3 px-1">
                                                <Activity className="w-4 h-4 text-red-500" />
                                                <span className="text-[12px] font-bold text-gray-800 uppercase tracking-widest">Recommended Training</span>
                                            </div>
                                            <div className="flex flex-col gap-2">
                                                {reviewMistakes.slice(0, 4).map((m: any, idx: number) => (
                                                    <div key={idx}
                                                        onClick={() => {
                                                            setCurrentMistakeIndex(idx);
                                                            setActiveTab('analysis');
                                                            setViewingMove(m.turn - 1);
                                                            setVariationBranch([]);
                                                            setShowHints(true);
                                                            setShowTerritory(true);
                                                        }}
                                                        className="flex flex-col bg-white border border-red-50 rounded-[8px] p-2.5 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group cursor-pointer">
                                                        <div className="absolute top-0 left-0 bottom-0 w-1 bg-gradient-to-b from-red-400 to-orange-400" />
                                                        <div className="flex items-center justify-between ml-2 pointer-events-none">
                                                            <div className="flex flex-col flex-1 min-w-0 pr-2">
                                                                <div className="flex items-center gap-2">
                                                                    <span className="font-bold text-[13px] text-gray-900 whitespace-nowrap">Move {m.turn}</span>
                                                                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-red-100/80 text-red-700 uppercase tracking-wider">{m.type === 'blunder' ? 'Blunder' : 'Mistake'}</span>
                                                                </div>
                                                                <div className="text-[11px] text-gray-500 font-medium mt-0.5 leading-snug truncate">
                                                                    Lost <span className="text-red-500 font-bold">{Math.abs(m.score_drop).toFixed(1)} pts</span> (<span className="text-red-500 font-bold">{(m.winrate_drop * 100).toFixed(0)}%</span> winrate)
                                                                </div>
                                                            </div>
                                                            <button className="pointer-events-auto shrink-0 px-3 py-1.5 bg-gray-900 hover:bg-black text-white text-[11px] font-bold rounded-[6px] transition-colors flex justify-center items-center gap-1.5 shadow-sm opacity-90 group-hover:opacity-100">
                                                                <Cpu className="w-3 h-3" /> Analyze
                                                            </button>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* MATCH TIMELINE GRAPH */}
                                    <div className="w-full relative shrink-0">
                                        <div className="flex items-center justify-between mb-2 px-1">
                                            <div className="text-[13px] font-bold text-[#1E1C19] flex items-center gap-1.5">
                                                <LineChart className="w-4 h-4 text-[#6a5a48]" /> Math Analysis
                                            </div>
                                            {/* Toggle Winrate / Score Lead */}
                                            <div className="flex bg-white/50 backdrop-blur-md rounded-[8px] p-1 relative z-10 shadow-[inset_0_1px_4px_rgba(0,0,0,0.05)] border border-[#503C28]/10">
                                                <button onClick={() => setGraphMode('winrate')} className={`px-2 py-0.5 text-[10px] font-bold tracking-wide uppercase rounded-[6px] transition-all ${graphMode === 'winrate' ? 'bg-gradient-to-b from-[#FFE1BC]/90 to-[#FFCE98]/80 text-[#1E1C19] shadow-sm border border-[#C38A4A]/20' : 'text-[#6E675F] hover:text-[#3A342E] bg-transparent'}`}>Winrate</button>
                                                <button onClick={() => setGraphMode('score')} className={`px-2 py-0.5 text-[10px] font-bold tracking-wide uppercase rounded-[6px] transition-all ${graphMode === 'score' ? 'bg-gradient-to-b from-[#FFE1BC]/90 to-[#FFCE98]/80 text-[#1E1C19] shadow-sm border border-[#C38A4A]/20' : 'text-[#6E675F] hover:text-[#3A342E] bg-transparent'}`}>Score Lead</button>
                                            </div>
                                        </div>
                                        <div className="h-[100px] w-full relative bg-[#F8F4F0]/80 rounded-[12px] overflow-hidden cursor-crosshair shadow-[inset_0_2px_6px_rgba(0,0,0,0.2)]">
                                            <div className="absolute top-1/2 left-0 right-0 border-t border-gray-300 border-dashed z-0 opacity-50" />
                                            <div className="absolute top-1 left-2 text-[9px] font-bold text-[#948C83] z-0">
                                                {graphMode === 'winrate' ? 'Black Winrate' : 'Score Lead (Black + / White -)'}
                                            </div>
                                            <svg className="absolute inset-0 w-full h-full text-[#C38A4A]" preserveAspectRatio="none" viewBox={`0 0 ${Math.max(moveHistory.length || 1, 1)} 100`}>
                                                <defs>
                                                    <linearGradient id="winrateGradient" x1="0" x2="0" y1="0" y2="1">
                                                        <stop offset="0%" stopColor="#C38A4A" stopOpacity="0.4" />
                                                        <stop offset="100%" stopColor="#C38A4A" stopOpacity="0.05" />
                                                    </linearGradient>
                                                    <linearGradient id="scoreGradientPos" x1="0" x2="0" y1="0" y2="1">
                                                        <stop offset="0%" stopColor="#948C83" stopOpacity="0.3" />
                                                        <stop offset="100%" stopColor="#948C83" stopOpacity="0.05" />
                                                    </linearGradient>
                                                </defs>
                                                {(() => {
                                                    const pts = [];

                                                    if (graphMode === 'winrate') {
                                                        let prevW = 50;
                                                        for (let i = 0; i <= moveHistory.length; i++) {
                                                            if (analysisHistory[i]) prevW = analysisHistory[i].winrate * 100;
                                                            pts.push(`${i},${100 - prevW}`);
                                                        }
                                                    } else {
                                                        let maxScore = 20;
                                                        for (let i = 0; i <= moveHistory.length; i++) {
                                                            if (analysisHistory[i] && typeof analysisHistory[i].scoreLead === 'number') {
                                                                maxScore = Math.max(maxScore, Math.abs(analysisHistory[i].scoreLead));
                                                            }
                                                        }
                                                        maxScore = Math.ceil(maxScore / 10) * 10;

                                                        let prevS = 0;
                                                        for (let i = 0; i <= moveHistory.length; i++) {
                                                            if (analysisHistory[i] && typeof analysisHistory[i].scoreLead === 'number') {
                                                                prevS = analysisHistory[i].scoreLead;
                                                            }
                                                            const y = 100 - (((prevS + maxScore) / (2 * maxScore)) * 100);
                                                            pts.push(`${i},${y}`);
                                                        }
                                                    }

                                                    const pathD = `M0,100 L${pts.join(' L')} L${moveHistory.length},100 Z`;
                                                    const lineD = `M${pts.join(' L')}`;
                                                    return (
                                                        <React.Fragment>
                                                            <path d={pathD} fill={graphMode === 'winrate' ? "url(#winrateGradient)" : "url(#scoreGradientPos)"} />
                                                            <path d={lineD} fill="none" stroke={graphMode === 'winrate' ? "currentColor" : "#948C83"} strokeWidth="0.5" vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" />
                                                        </React.Fragment>
                                                    )
                                                })()}
                                            </svg>

                                            {/* Plotted Error Dots */}
                                            {Array.from({ length: moveHistory.length + 1 }).map((_, i) => {
                                                const quality = i > 0 ? getMoveQuality(i) : null;
                                                const isSignificantError = quality && (quality.label === 'Mistake' || quality.label === 'Blunder' || quality.label === 'Inaccuracy');
                                                if (!isSignificantError) return null;

                                                let yCoord = `calc(50% - 3px)`;
                                                if (graphMode === 'winrate') {
                                                    const w = analysisHistory[i] ? analysisHistory[i].winrate * 100 : 50;
                                                    yCoord = `calc(${100 - w}% - 3px)`;
                                                } else {
                                                    let maxS = 20;
                                                    Object.values(analysisHistory).forEach((a: any) => {
                                                        if (typeof a.scoreLead === 'number') maxS = Math.max(maxS, Math.abs(a.scoreLead));
                                                    });
                                                    const maxScore = Math.ceil(maxS / 10) * 10;
                                                    const frame = (analysisHistory as any)[i];
                                                    const s = frame && typeof frame.scoreLead === 'number' ? frame.scoreLead : 0;
                                                    const yPercentage = 100 - (((s + maxScore) / (2 * maxScore)) * 100);
                                                    yCoord = `calc(${yPercentage}% - 3px)`;
                                                }

                                                return (
                                                    <div
                                                        key={i}
                                                        className={`absolute w-1.5 h-1.5 rounded-full bg-[#d9a35f] shadow-[0_1px_3px_rgba(217,163,95,0.4)] z-10 -ml-[3px] pointer-events-none`}
                                                        style={{
                                                            left: `${(i / Math.max(1, moveHistory.length)) * 100}%`,
                                                            top: yCoord
                                                        }}
                                                        title={`${quality.label}: lost ${quality.delta.toFixed(1)} pts`}
                                                    />
                                                );
                                            })}

                                            <div
                                                className="absolute inset-0 z-20 cursor-crosshair hover:bg-black/5 transition-colors"
                                                style={{ touchAction: 'none' }}
                                                onPointerDown={(e) => {
                                                    const rect = e.currentTarget.getBoundingClientRect();
                                                    const move = Math.round(((e.clientX - rect.left) / rect.width) * moveHistory.length);
                                                    setViewingMove(move === moveHistory.length ? null : Math.max(0, Math.min(move, moveHistory.length)));
                                                    e.currentTarget.setPointerCapture(e.pointerId);
                                                }}
                                                onPointerMove={(e) => {
                                                    if (e.buttons === 1) {
                                                        const rect = e.currentTarget.getBoundingClientRect();
                                                        const move = Math.round(((e.clientX - rect.left) / rect.width) * moveHistory.length);
                                                        setViewingMove(move === moveHistory.length ? null : Math.max(0, Math.min(move, moveHistory.length)));
                                                    }
                                                }}
                                            >
                                                {(viewingMove !== null || moveHistory.length === 0 || gameState === 'finished') && (
                                                    <div className="absolute top-0 bottom-0 w-[2px] bg-[#C38A4A] shadow-[0_0_12px_rgba(195,138,74,0.6)] pointer-events-none transition-all duration-75"
                                                        style={{ left: `calc(${Math.min(100, Math.max(0, ((viewingMove !== null ? viewingMove : moveHistory.length) / Math.max(1, moveHistory.length)) * 100))}% - 1px)` }}
                                                    />
                                                )}
                                            </div>
                                        </div>

                                        {/* X-Axis Labels */}
                                        <div className="w-full flex justify-between px-1 text-[9px] text-gray-400 mt-1 font-semibold select-none">
                                            {Array.from({ length: 5 }).map((_, i) => (
                                                <span key={i}>{Math.round((moveHistory.length / 4) * i)}</span>
                                            ))}
                                        </div>

                                        {/* Embedded Paginator */}
                                        <div className="flex items-center justify-center gap-3 lg:gap-5 text-gray-500 mt-2 mb-2 bg-white/60 backdrop-blur-md border border-[#503C28]/10 rounded-[14px] p-2 w-full shadow-[inset_0_1px_0_rgba(255,255,255,0.7),_0_6px_16px_rgba(30,20,10,0.04)] select-none">
                                            <button onClick={() => setViewingMove(0)} className="hover:text-[#3A342E] hover:bg-[#F4F0EC]/80 px-2 py-1.5 rounded-[10px] transition-colors font-bold text-[#948C83]">&lt;&lt;</button>
                                            <button onClick={() => setViewingMove(viewingMove !== null ? Math.max(0, viewingMove - 1) : Math.max(0, moveHistory.length - 1))} className="hover:text-[#3A342E] hover:bg-[#F4F0EC]/80 px-3 py-1.5 rounded-[10px] transition-colors font-bold text-[#6E675F]">&lt;</button>
                                            <span className="font-bold text-[#1E1C19] text-[13px] min-w-[60px] text-center tracking-wide flex-1">
                                                {viewingMove !== null ? viewingMove : moveHistory.length} <span className="font-medium text-[#948C83]">/ {moveHistory.length}</span>
                                            </span>
                                            <button onClick={() => setViewingMove(viewingMove !== null ? Math.min(moveHistory.length, viewingMove + 1) : null)} className="hover:text-[#3A342E] hover:bg-[#F4F0EC]/80 px-3 py-1.5 rounded-[10px] transition-colors font-bold text-[#6E675F]">&gt;</button>
                                            <button onClick={() => setViewingMove(null)} className="hover:text-[#3A342E] hover:bg-[#F4F0EC]/80 px-2 py-1.5 rounded-[10px] transition-colors font-bold text-[#948C83]">&gt;&gt;</button>
                                        </div>
                                    </div>

                                    {/* AGGREGATE MOVE QUALITY MATRIX */}
                                    {matchStats && (
                                        <div className="w-full bg-white border border-gray-200 rounded-[12px] overflow-hidden shrink-0 mt-2 shadow-sm">
                                            {selectedQualityCategory ? (
                                                <div className="flex flex-col">
                                                    <div
                                                        className="flex items-center gap-2 p-2.5 border-b border-gray-200 bg-gray-50 cursor-pointer hover:bg-gray-100 transition-colors"
                                                        onClick={() => setSelectedQualityCategory(null)}
                                                    >
                                                        <ArrowLeft className="w-4 h-4 text-gray-500" />
                                                        <div className="text-[11px] font-bold text-gray-600 uppercase tracking-wider">{selectedQualityCategory} Moves</div>
                                                    </div>
                                                    <div className="flex flex-col max-h-[220px] overflow-y-auto custom-scrollbar relative">
                                                        {moveHistory.map((mv, i) => {
                                                            const q = getMoveQuality(i + 1);
                                                            if (q && q.label === selectedQualityCategory) {
                                                                return (
                                                                    <div key={i} className="flex flex-col border-b border-gray-100 last:border-0">
                                                                        <div
                                                                            className={`flex items-center justify-between p-2.5 hover:bg-gray-50 cursor-pointer transition-colors ${expandedMistake === i + 1 ? 'bg-[#F4F0EC]/60' : ''}`}
                                                                            onClick={() => {
                                                                                if (expandedMistake === i + 1) {
                                                                                    setExpandedMistake(null);
                                                                                } else {
                                                                                    setExpandedMistake(i + 1);
                                                                                    setViewingMove(i);
                                                                                }
                                                                            }}
                                                                        >
                                                                            <div className="flex items-center gap-3">
                                                                                <div className={`w-3 h-3 rounded-full ${q.color} shadow-sm`} />
                                                                                <div className="flex items-baseline gap-2">
                                                                                    <span className="text-[13px] font-bold text-gray-800">Move {i + 1}</span>
                                                                                    <span className="text-[10px] uppercase font-bold text-gray-400">{mv.p === 'b' ? 'Black' : 'White'}</span>
                                                                                </div>
                                                                            </div>
                                                                            <div className={`text-[12px] font-bold ${selectedQualityCategory === 'Excellent' || selectedQualityCategory === 'Great' ? 'text-[#C38A4A]' : 'text-[#6a5a48]'}`}>
                                                                                {q.delta >= 0 ? '-' : '+'}{Math.abs(q.delta).toFixed(1)} pts
                                                                            </div>
                                                                        </div>

                                                                        {/* Expanded KataGo Analytics Dropdown */}
                                                                        {expandedMistake === i + 1 && (
                                                                            <div className="bg-[#FAF8F5]/50 p-3 pt-2 border-t border-[#503C28]/10 flex flex-col gap-2">
                                                                                {rawHints.length === 0 ? (
                                                                                    <div className="flex items-center gap-2 text-[11px] font-bold text-[#C38A4A] uppercase tracking-widest px-1">
                                                                                        <div className="w-3 h-3 border-2 border-[#C38A4A] border-t-transparent rounded-full animate-spin"></div>
                                                                                        Evaluating position on board...
                                                                                    </div>
                                                                                ) : (
                                                                                    <div className="flex flex-col gap-1.5 font-mono text-[#3A342E]">
                                                                                        {/* User Factual Mistake */}
                                                                                        <div className="flex flex-col border-[#503C28]/10">
                                                                                            <div className="text-[11px] font-bold text-[#C38A4A] uppercase tracking-widest mb-2 flex items-center gap-1.5">
                                                                                                <Activity className="w-3.5 h-3.5" /> Your Move
                                                                                            </div>
                                                                                            <div className="flex justify-between items-center bg-white/50 border border-[#503C28]/10 px-2 py-1.5 rounded-[6px] shadow-sm">
                                                                                                <div className="flex items-center gap-2">
                                                                                                    <span className="font-black text-[10px] px-1.5 py-0.5 rounded-[4px] bg-[#C38A4A]/20 text-[#3A342E] shadow-sm">PLAYED</span>
                                                                                                    <span className="font-bold text-[13px] w-8 text-[#1E1C19]">{mv.c}</span>
                                                                                                </div>
                                                                                                <div className="text-[11px] font-bold text-[#d9a35f]">
                                                                                                    -{q.delta.toFixed(1)} pts
                                                                                                </div>
                                                                                            </div>
                                                                                        </div>
                                                                                    </div>
                                                                                )}
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                );
                                                            }
                                                            return null;
                                                        })}
                                                        {(!moveHistory.some((_, i) => {
                                                            const q = getMoveQuality(i + 1);
                                                            return q && q.label === selectedQualityCategory;
                                                        })) && (
                                                                <div className="p-4 text-center text-gray-400 text-[12px] font-medium italic">No moves match this category.</div>
                                                            )}
                                                    </div>
                                                </div>
                                            ) : (
                                                <React.Fragment>
                                                    <table className="w-full text-left border-collapse text-[12px]">
                                                        <thead>
                                                            <tr className="bg-white/40 border-b border-[#503C28]/10 text-gray-500 uppercase tracking-widest text-[9px] font-bold">
                                                                <th className="py-2.5 px-3">Type</th>
                                                                <th className="py-2.5 px-2 text-center border-l border-[#503C28]/5"><div className="flex items-center justify-center gap-1"><div className="w-2 h-2 bg-black rounded-full shadow-sm" /> Black</div></th>
                                                                <th className="py-2.5 px-2 text-center text-[#948C83]">%</th>
                                                                <th className="py-2.5 px-2 text-center border-l border-[#503C28]/5"><div className="flex items-center justify-center gap-1"><div className="w-2 h-2 bg-white border border-gray-300 rounded-full shadow-sm" /> White</div></th>
                                                                <th className="py-2.5 px-2 text-center text-[#948C83]">%</th>
                                                                <th className="py-2.5 px-2 text-center w-6"></th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="font-semibold text-[#3A342E]">
                                                            {[
                                                                { key: 'Excellent', color: 'bg-[#d9a35f]', label: 'Excellent' },
                                                                { key: 'Great', color: 'bg-[#C38A4A]', label: 'Great' },
                                                                { key: 'Good', color: 'bg-[#948C83]', label: 'Good' },
                                                                { key: 'Inaccuracy', color: 'bg-[#6E675F]', label: 'Inaccuracy' },
                                                                { key: 'Mistake', color: 'bg-[#503C28]', label: 'Mistake' },
                                                                { key: 'Blunder', color: 'bg-[#3A342E]', label: 'Blunder' }
                                                            ].map(row => (
                                                                <tr
                                                                    key={row.key}
                                                                    className="border-b border-[#503C28]/5 last:border-0 hover:bg-white/60 bg-white/40 cursor-pointer transition-colors group"
                                                                    onClick={() => setSelectedQualityCategory(row.label)}
                                                                >
                                                                    <td className="py-2 px-3 flex items-center gap-2">
                                                                        <div className={`w-2 h-2 rounded-full ${row.color} shadow-sm`} /> {row.label}
                                                                    </td>
                                                                    <td className="py-2 px-2 text-center border-l border-[#503C28]/5">{matchStats.black[row.key]}</td>
                                                                    <td className="py-2 px-2 text-center text-[#948C83] font-medium text-[10px]">{(matchStats.black[row.key] / Math.max(1, matchStats.black.count) * 100).toFixed(1)}%</td>
                                                                    <td className="py-2 px-2 text-center border-l border-[#503C28]/5">{matchStats.white[row.key]}</td>
                                                                    <td className="py-2 px-2 text-center text-[#948C83] font-medium text-[10px]">{(matchStats.white[row.key] / Math.max(1, matchStats.white.count) * 100).toFixed(1)}%</td>
                                                                    <td className="py-2 px-2 text-center border-l border-[#503C28]/5">
                                                                        <div className="w-full flex justify-center items-center h-full opacity-40 group-hover:opacity-100 transition-opacity">
                                                                            <ChevronRight className="w-3.5 h-3.5 text-[#C38A4A]" />
                                                                        </div>
                                                                    </td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                    <div className="bg-gray-50 border-t border-gray-200 py-1.5 text-center text-[10px] text-gray-400 font-bold uppercase tracking-widest shadow-inner">
                                                        Total Game Plies: {moveHistory.length}
                                                    </div>
                                                </React.Fragment>
                                            )}
                                        </div>
                                    )}

                                    {/* WINNER BANNER */}
                                    <div className="mt-auto pt-6 pb-2 w-full shrink-0">
                                        <div className="bg-white/55 border border-[#503C28]/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.6),_0_8px_20px_rgba(30,20,10,0.05)] rounded-[20px] p-5 flex flex-col items-center justify-center text-center gap-4 relative overflow-hidden">
                                            <div className="absolute inset-0 bg-gradient-to-b from-white/40 to-transparent pointer-events-none" />
                                            <div className="relative z-10 w-full">
                                                <div className="text-[12px] uppercase tracking-widest text-[#C38A4A] font-bold mb-1 opacity-90">Match Concluded</div>
                                                <div className="text-2xl font-black text-[#1E1C19]">{winner ? winner.split('_').map(w => w.toUpperCase()).join(' ') : 'Finished'}</div>
                                            </div>
                                            <div className="flex w-full gap-3 relative z-10">
                                                <button onClick={() => window.location.reload()} className={`py-3 bg-gradient-to-b from-[#1a1a1a] to-[#0f0f0f] border border-white/5 shadow-[0_12px_30px_rgba(0,0,0,0.35),_inset_0_1px_0_rgba(255,255,255,0.08)] text-white/95 font-bold rounded-[16px] hover:from-[#2a2a2a] hover:to-[#1a1a1a] transition-colors ${reviewMistakes.length > 0 ? 'w-full' : 'flex-1'}`}>
                                                    Rematch
                                                </button>
                                                {reviewMistakes.length === 0 && (
                                                    <button onClick={handleReviewMistakes} disabled={isAnalyzingMistakes} className="flex-1 py-3 bg-gradient-to-b from-white/70 to-[#F8F4F0]/80 border border-[#503C28]/10 text-[#3A342E] shadow-[0_6px_16px_rgba(30,20,10,0.06),_inset_0_1px_0_rgba(255,255,255,0.7)] flex justify-center items-center gap-2 font-bold rounded-[14px] hover:from-[#FAF6F2]/90 hover:to-[#EBE5DF]/90 transition-colors disabled:opacity-50">
                                                        {isAnalyzingMistakes ? <div className="w-5 h-5 border-2 border-[#C38A4A]/30 border-t-[#C38A4A] rounded-full animate-spin"></div> : <Cpu className="w-5 h-5 text-[#948C83]" />} Analyze Mistakes
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <React.Fragment>
                                    {/* Match Info shifted to Global Header Row for seamless top-bar navigation */}

                                    {/* Tabs Header */}
                                    <div className="flex gap-2 border-b border-[#F0F0F0]/0 shrink-0 mb-6">
                                        <button onClick={() => setActiveTab('chat')} className={`flex-1 py-2.5 text-[13px] font-bold transition-all rounded-[14px] ${activeTab === 'chat' ? 'bg-gradient-to-b from-[rgba(255,225,188,0.95)] to-[rgba(255,206,152,0.82)] border border-[rgba(195,138,74,0.38)] shadow-[0_10px_24px_rgba(193,132,68,0.18),_inset_0_1px_0_rgba(255,255,255,0.62)] text-[#1E1C19]' : 'text-[#7E766D] hover:text-[#3A342E]'}`}>
                                            Chat
                                        </button>
                                        <button onClick={() => setActiveTab('analysis')} className={`flex-1 py-2.5 text-[13px] font-bold transition-all rounded-[14px] ${activeTab === 'analysis' ? 'bg-gradient-to-b from-[rgba(255,225,188,0.95)] to-[rgba(255,206,152,0.82)] border border-[rgba(195,138,74,0.38)] shadow-[0_10px_24px_rgba(193,132,68,0.18),_inset_0_1px_0_rgba(255,255,255,0.62)] text-[#1E1C19]' : 'text-[#7E766D] hover:text-[#3A342E]'}`}>
                                            Analysis
                                        </button>
                                        <button onClick={() => setActiveTab('tree')} className={`flex-1 py-2.5 text-[13px] font-bold transition-all rounded-[14px] ${activeTab === 'tree' ? 'bg-gradient-to-b from-[rgba(255,225,188,0.95)] to-[rgba(255,206,152,0.82)] border border-[rgba(195,138,74,0.38)] shadow-[0_10px_24px_rgba(193,132,68,0.18),_inset_0_1px_0_rgba(255,255,255,0.62)] text-[#1E1C19]' : 'text-[#7E766D] hover:text-[#3A342E]'}`}>
                                            Tree
                                        </button>
                                    </div>

                                    {/* Tabs Content */}
                                    <div className="flex-1 overflow-y-auto hide-scrollbar">
                                        {/* COMPONENT 7 - Chat */}
                                        {activeTab === 'chat' && (
                                            <div className="flex flex-col gap-4">
                                                <div className="flex flex-col gap-1">
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-6 h-6 rounded-full bg-[#E5F1EB] flex items-center justify-center">
                                                            <Cpu className="w-3.5 h-3.5 text-[#4CAF84]" />
                                                        </div>
                                                        <span className="text-[14px] font-bold text-gray-900">KataGo</span>
                                                        <span className="text-[12px] text-gray-400 ml-auto mr-1">7:02</span>
                                                    </div>
                                                    <div className="text-[14px] text-gray-600 pl-8">Good luck!</div>
                                                </div>
                                            </div>
                                        )}

                                        {/* COMPONENT 8 - Analysis */}
                                        {activeTab === 'analysis' && (
                                            <div className="flex flex-col gap-4 px-2 mt-4 relative z-10">
                                                {/* TUTOR CONTROLS */}
                                                <div className="bg-white/55 rounded-[20px] p-4 text-center border border-[#503C28]/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.6),_0_8px_20px_rgba(30,20,10,0.05)] flex flex-col gap-3 relative overflow-hidden">
                                                    <div className="absolute inset-0 bg-gradient-to-br from-white/40 to-transparent pointer-events-none" />
                                                    <div className="text-[13px] font-bold text-[#3A342E] flex items-center justify-center gap-1.5 relative z-10">
                                                        <Lightbulb className="w-4 h-4 text-[#C38A4A]" /> AI Tutor Assists
                                                    </div>
                                                    <div className="flex gap-2 justify-center relative z-10">
                                                        <button onClick={() => setShowHints(!showHints)} className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-[14px] font-bold text-[13px] transition-colors border shadow-[0_6px_14px_rgba(30,20,10,0.08),_inset_0_1px_0_rgba(255,255,255,0.7)] border-[#503C28]/10 ${showHints ? 'bg-[#EBE5DF]/90 shadow-[inset_0_2px_4px_rgba(0,0,0,0.05)] text-[#3A342E] translate-y-[1px]' : 'bg-gradient-to-b from-white/80 to-[#FAF6F2]/90 text-[#3A342E] hover:from-[#FAF6F2]/90 hover:to-[#EBE5DF]/90'}`}>
                                                            {showHints ? 'Hide Hints' : 'Show Hints'}
                                                        </button>
                                                        <button onClick={handleUndo} disabled={moveHistory.length < 2 || isBotThinking || gameState !== 'playing'} className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-[14px] bg-gradient-to-b from-white/80 to-[#FAF6F2]/90 border border-[#503C28]/10 hover:from-[#FAF6F2]/90 hover:to-[#EBE5DF]/90 text-[#3A342E] font-bold text-[13px] transition-colors shadow-[0_6px_14px_rgba(30,20,10,0.08),_inset_0_1px_0_rgba(255,255,255,0.7)] disabled:opacity-50 disabled:cursor-not-allowed">
                                                            <Undo2 className="w-4 h-4" /> Takeback
                                                        </button>
                                                    </div>
                                                    <div className="flex gap-2 justify-center relative z-10 w-full mt-2">
                                                        <button onClick={() => setShowTerritory(!showTerritory)} className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-[14px] font-bold text-[13px] transition-colors border shadow-[0_6px_14px_rgba(30,20,10,0.08),_inset_0_1px_0_rgba(255,255,255,0.7)] border-[#503C28]/10 ${showTerritory ? 'bg-[#EBE5DF]/90 shadow-[inset_0_2px_4px_rgba(0,0,0,0.05)] text-[#3A342E] translate-y-[1px]' : 'bg-gradient-to-b from-white/80 to-[#FAF6F2]/90 text-[#3A342E] hover:from-[#FAF6F2]/90 hover:to-[#EBE5DF]/90'}`}>
                                                            <Layers className="w-4 h-4" /> {showTerritory ? 'Hide Territory' : 'Map Territory'}
                                                        </button>
                                                    </div>
                                                    <div className="flex gap-2 justify-center relative z-10 w-full mt-2 mb-2 flex-col">
                                                        <button
                                                            onClick={() => {
                                                                setTuitionMode(!tuitionMode);
                                                                if (!tuitionMode) {
                                                                    setTuitionCandidates([]);
                                                                    setShowHints(false);
                                                                }
                                                            }}
                                                            className={`w-full flex items-center justify-center gap-1.5 py-2 rounded-[14px] font-bold text-[13px] transition-colors shadow-[0_6px_14px_rgba(30,20,10,0.08),_inset_0_1px_0_rgba(255,255,255,0.7)] ${tuitionMode ? 'bg-gradient-to-b from-[#FFE1BC]/90 to-[#FFCE98]/80 border border-[#C38A4A]/35 shadow-[0_10px_24px_rgba(193,132,68,0.18),_inset_0_1px_0_rgba(255,255,255,0.6)] text-[#1E1C19]' : 'opacity-60 bg-gradient-to-b from-white/80 to-[#FAF6F2]/90 border border-[#503C28]/10 text-[#3A342E] hover:opacity-100 hover:from-[#FAF6F2]/90 hover:to-[#EBE5DF]/90'}`}>
                                                            <GraduationCap className="w-4 h-4" /> Tuition Mode {tuitionMode ? 'ON' : 'OFF'}
                                                        </button>
                                                        {(tuitionMode || tuitionScore > 0) && (
                                                            <div className="w-full text-[12px] font-bold bg-white/50 border border-[#785A3C]/15 text-[#6a5a48] rounded-[6px] px-3 py-1.5 flex items-center justify-between shadow-sm">
                                                                <div className="flex items-center gap-1.5"><Target className="w-3.5 h-3.5" /> Learning Mode</div>
                                                                <span>{tuitionScore} PT</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div className="flex gap-2 justify-center relative z-10 w-full mt-1">
                                                        <select
                                                            value={hintStrategy}
                                                            onChange={(e) => setHintStrategy(e.target.value)}
                                                            className="w-full py-2 px-3 rounded-[12px] bg-white/85 backdrop-blur-[12px] border border-[#503C28]/10 shadow-[inset_0_2px_6px_rgba(30,20,10,0.08),_inset_0_1px_0_rgba(255,255,255,0.6)] text-[#3A342E] font-bold text-[13px] hover:border-[#503C28]/20 focus:outline-none focus:border-[#C38A4A] appearance-none cursor-pointer"
                                                            style={{ backgroundImage: `url('data:image/svg+xml;utf8,<svg fill="none" class="w-4 h-4 text-gray-400" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>')`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 0.75rem center', backgroundSize: '1rem' }}
                                                        >
                                                            <option value="balanced">⚖️ Strategy: Balanced</option>
                                                            <option value="territory">🏕️ Strategy: Territory (Edges)</option>
                                                            <option value="influence">🌌 Strategy: Influence (Center)</option>
                                                            <option value="fighting">⚔️ Strategy: Aggressive (Contact)</option>
                                                        </select>
                                                    </div>

                                                    <div className="flex bg-[#F4F0EC]/80 p-1 rounded-[10px] mt-[10px] w-full select-none border border-[#503C28]/10 shadow-[inset_0_1px_4px_rgba(0,0,0,0.05)]">
                                                        <button onClick={() => setGraphMode('winrate')} className={`flex-1 flex justify-center items-center gap-1.5 text-[11px] font-bold py-2 rounded-[6px] transition-all duration-300 ${graphMode === 'winrate' ? 'bg-gradient-to-b from-[#FFE1BC]/95 to-[#FFCE98]/82 shadow-[0_6px_16px_rgba(193,132,68,0.2),_inset_0_1px_0_rgba(255,255,255,0.6)] border border-[#C38A4A]/35 text-[#1E1C19]' : 'text-[#6E675F] hover:text-[#3A342E] hover:bg-white/50'}`}>
                                                            Winrate
                                                        </button>
                                                        <button onClick={() => setGraphMode('score')} className={`flex-1 flex justify-center items-center gap-1.5 text-[11px] font-bold py-2 rounded-[6px] transition-all duration-300 ${graphMode === 'score' ? 'bg-gradient-to-b from-[#FFE1BC]/95 to-[#FFCE98]/82 shadow-[0_6px_16px_rgba(193,132,68,0.2),_inset_0_1px_0_rgba(255,255,255,0.6)] border border-[#C38A4A]/35 text-[#1E1C19]' : 'text-[#6E675F] hover:text-[#3A342E] hover:bg-white/50'}`}>
                                                            Territory
                                                        </button>
                                                    </div>
                                                </div>

                                                <div className="bg-white/55 border border-[#503C28]/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.6),_0_8px_20px_rgba(30,20,10,0.05)] rounded-[20px] p-5 mt-4">
                                                    <div className="flex justify-between items-end mb-3">
                                                        <span className="text-[12px] font-bold text-[#948C83] uppercase tracking-widest">{graphMode === 'winrate' ? 'Black Winrate' : 'Score Lead'}</span>
                                                        <span className="text-[20px] font-black text-[#1E1C19]">
                                                            {graphMode === 'winrate'
                                                                ? `${winrate !== null ? (winrate * 100).toFixed(1) : 50.0}%`
                                                                : (scoreLead !== null ? (scoreLead > 0 ? `B+${scoreLead.toFixed(1)}` : (scoreLead < 0 ? `W+${Math.abs(scoreLead).toFixed(1)}` : '0.0')) : '0.0')}
                                                        </span>
                                                    </div>
                                                    <div className="h-[12px] bg-[#d9d4ce] rounded-[10px] flex items-center overflow-hidden w-full relative shadow-inner">
                                                        <div className="h-full transition-all duration-500 shadow-[inset_0_2px_4px_rgba(0,0,0,0.5),_0_2px_6px_rgba(0,0,0,0.15)]" style={{
                                                            background: 'linear-gradient(180deg, #111, #000)',
                                                            width: graphMode === 'winrate'
                                                                ? `${winrate !== null ? winrate * 100 : 50}%`
                                                                : `${Math.min(100, Math.max(0, (((scoreLead || 0) + 40) / 80) * 100))}%`
                                                        }}></div>
                                                    </div>
                                                    <div className="text-center mt-3 text-[13px] font-bold text-[#6E675F]">
                                                        {graphMode === 'winrate'
                                                            ? (scoreLead !== null ? `Est. Score: ${scoreLead > 0 ? `B+${scoreLead.toFixed(1)}` : `W+${Math.abs(scoreLead).toFixed(1)}`}` : 'Est. Score: --')
                                                            : (winrate !== null ? `Winrate: ${(winrate * 100).toFixed(1)}%` : 'Winrate: --')}
                                                    </div>
                                                </div>

                                                {hints.length > 0 && (
                                                    <div className="mt-4 bg-[#FAF8F5]/80 rounded-[16px] p-4 border border-[#503C28]/10 shadow-[0_12px_28px_rgba(30,20,10,0.08),_inset_0_1px_0_rgba(255,255,255,0.6)]">
                                                        <div className="text-[13px] font-bold text-[#3A342E] mb-3 flex items-center gap-2 uppercase tracking-wide">
                                                            <Cpu className="w-4 h-4 text-[#C38A4A]" /> KataGo Top Moves
                                                        </div>
                                                        <div className="flex flex-col gap-2">
                                                            {hints.map((h, i) => (
                                                                <div key={i} className="flex justify-between items-center text-sm border-b border-[#503C28]/10 pb-2 last:border-0 last:pb-0">
                                                                    <div className="flex items-center gap-2 w-16">
                                                                        <div className={`w-2 h-2 rounded-full ${i === 0 ? 'bg-[#d9a35f]' : 'bg-[#948C83]'}`}></div>
                                                                        <span className="font-semibold text-gray-900">{h.move}</span>
                                                                    </div>
                                                                    <div className="text-gray-500 w-16 text-right">{(h.winrate * 100).toFixed(1)}%</div>
                                                                    <div className="text-gray-500 w-16 text-right">{h.scoreLead > 0 ? 'B+' : 'W+'}{Math.abs(h.scoreLead).toFixed(1)}</div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        {/* COMPONENT 6 - Tree Moves List */}
                                        {activeTab === 'tree' && (
                                            <div className="flex flex-col gap-3">
                                                {moveHistory.length === 0 ? (
                                                    <div className="text-[14px] font-medium text-[#948C83] p-4 text-center mt-4 bg-white/40 border border-[#503C28]/10 rounded-[14px]">No moves yet</div>
                                                ) : moveHistory.map((node, i) => {
                                                    const isSel = viewingMove === i + 1 || (viewingMove === null && i === moveHistory.length - 1);
                                                    return (
                                                        <div key={i} onClick={() => setViewingMove(i + 1)} className={`h-[44px] px-4 flex items-center rounded-[14px] cursor-pointer text-[14px] transition-all group ${isSel ? 'bg-gradient-to-b from-[rgba(255,248,240,0.88)] to-[rgba(248,240,230,0.92)] border border-[rgba(195,138,74,0.18)] shadow-[0_8px_18px_rgba(25,18,12,0.08),_inset_0_1px_0_rgba(255,255,255,0.68)]' : 'bg-gradient-to-b from-white/70 to-[#F8F4F0]/88 border border-[#503C28]/10 shadow-[0_6px_16px_rgba(30,20,10,0.06),_inset_0_1px_0_rgba(255,255,255,0.70)] hover:-translate-y-[1px] hover:shadow-[0_8px_20px_rgba(30,20,10,0.08),_inset_0_1px_0_rgba(255,255,255,0.72)]'}`}>
                                                            <span className="w-10 text-[#948C83] font-medium">{node.m}</span>
                                                            <span className={`font-bold ${isSel ? 'text-[#d9a35f]' : 'text-[#3A342E]'}`}>{node.c}</span>
                                                            <div className="ml-auto flex items-center justify-center w-5 h-5">
                                                                <div className={`w-2 h-2 rounded-full shadow-sm ${node.p === 'b' ? 'bg-[#1A1A1A]' : 'bg-white border border-[#948C83]/30'}`} />
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                </React.Fragment>
                            )}
                        </div>
                    </div>
                </main >
            </div >

            {/* SETUP OVERLAY */}
            <AnimatePresence>
                {
                    gameState === 'setup' && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/10 backdrop-blur-sm"
                        >
                            <div className="w-full max-w-[600px] mx-auto">
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
                                <div className="setup-panel flex flex-col relative w-full h-auto max-h-[90vh] overflow-hidden">
                                    <div className="hero-zone shrink-0">
                                        <button onClick={() => router.push('/')} className="absolute left-6 top-[28px] text-gray-800/40 hover:text-gray-900 transition-colors z-[50]">
                                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" /></svg>
                                        </button>
                                        <div className="hero-title">Play vs AI</div>
                                        <div className="hero-subtitle">Train against KataGo models</div>
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

                                        {/* TIME CONTROL */}
                                        <div className="setup-section">
                                            <div className="section-title mb-2">
                                                Time Control
                                            </div>
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
                                                        <div className="text-[15px] font-black leading-none" style={{ color: timeTier === tier ? '#7A4B1A' : '#1E1C19' }}>{(TIME_CONFIG as any)[boardSize][tier].label}</div>
                                                    </div>
                                                ))}
                                            </div>
                                            <div className="grid grid-cols-2 gap-2 mt-3 p-2 bg-[rgba(255,255,255,0.4)] rounded-2xl border border-[rgba(80,60,40,0.04)] shadow-[inset_0_2px_10px_rgba(45,30,20,0.02)]">
                                                {((TIME_CONFIG as any)[boardSize][timeTier].presets).map((preset: any) => (
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

                                        <div className="premium-divider" />

                                        {/* BOT OPPONENT */}
                                        <div className="setup-section">
                                            <div className="section-title mb-2">
                                                KataGo Opponent
                                                <span className="section-subtitle">Select AI model</span>
                                            </div>
                                            <div className="flex flex-col gap-2">
                                                {BOT_PROFILES.map(bot => (
                                                    <div
                                                        key={bot.id}
                                                        onClick={() => setBotId(bot.id)}
                                                        className={`choice-chip flex-col !items-start !text-left py-3 px-4 ${botId === bot.id ? 'active' : ''}`}
                                                    >
                                                        <div className="flex items-center gap-2 mb-0.5">
                                                            <div className="font-bold text-[14px] leading-none" style={{ color: botId === bot.id ? '#7A4B1A' : '#1E1C19' }}>{bot.label}</div>
                                                            <span className="text-[9px] uppercase font-black tracking-widest text-[#948C83] px-1.5 py-0.5 rounded bg-[rgba(0,0,0,0.04)] leading-none">{bot.rank}</span>
                                                        </div>
                                                        <div className="text-[11px] font-medium leading-tight text-[#948C83] mt-1">{bot.desc}</div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="pt-2 z-20 pb-0 shrink-0">
                                        <button onClick={handleStartMatch} className="cta-btn w-full h-[48px] rounded-[16px] font-bold text-[14px] tracking-wide transition-all flex items-center justify-center gap-2 outline-none">
                                            <svg className="w-4 h-4 opacity-90" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg> Start Local AI
                                        </button>
                                    </div>
                                </div> {/* END setup-panel */}
                            </div> {/* END max-w-600px wrapper */}
                        </motion.div>
                    )
                }
            </AnimatePresence >


        </div >
    );
}
