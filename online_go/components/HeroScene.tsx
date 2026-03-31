import React, { useState, Fragment } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/router';
import HeroBoard from './HeroBoard';

export function HeroBackground() {
    return (
        <div className="absolute inset-0 z-0 bg-[#0A0807]">
            <img
                src="/hero-board.jpg"
                alt="Cinematic Go Board Environment"
                className="absolute inset-0 w-full h-full object-cover object-[80%_center] lg:object-center z-0"
                style={{ filter: "blur(1.2px) brightness(0.7) saturate(0.9)", transform: "scale(1.02)" }}
            />
            {/* Atmospheric overlay */}
            <div className="absolute inset-0 z-10" style={{ background: "radial-gradient(circle at 28% 20%, rgba(255, 180, 110, 0.08), transparent 28%), radial-gradient(circle at 68% 34%, rgba(255, 160, 80, 0.10), transparent 34%), linear-gradient(180deg, rgba(10,8,7,0.18), rgba(8,7,6,0.30))" }} />
            {/* Vignette */}
            <div className="absolute inset-0 z-20 pointer-events-none flex" style={{ background: "radial-gradient(circle at center, transparent 40%, rgba(0,0,0,0.22) 100%)" }} />
            {/* Focal Light */}
            <div className="absolute left-[22%] top-[25%] w-[400px] h-[400px] z-30 pointer-events-none" style={{ background: "radial-gradient(circle, rgba(255, 190, 120, 0.2), transparent 70%)", filter: "blur(60px)" }} />
        </div>
    )
}



export function HeroPanelGlow() {
    return (
        <>
            <div
                className="pointer-events-none absolute inset-0 rounded-[28px]"
                style={{
                    background: `
            radial-gradient(circle at 18% 12%, rgba(255,220,170,0.22), transparent 34%),
            radial-gradient(circle at 80% 10%, rgba(255,220,170,0.08), transparent 28%)
          `
                }}
            />
            <div className="pointer-events-none absolute inset-0 rounded-[28px] shadow-[inset_0_1px_0_rgba(255,255,255,0.22)]" />
        </>
    )
}

export function MultiplayerHeroButton() {
    return (
        <Link href="/play/online" className="group relative flex h-[58px] w-full items-center justify-center rounded-[18px] border border-white/[0.05] font-semibold text-white bg-gradient-to-b from-[#141414] to-[#050505] shadow-[0_20px_50px_rgba(0,0,0,0.6)] transition-all duration-300 hover:-translate-y-[3px] hover:scale-[1.01] hover:from-[#1a1a1a] hover:to-[#080808] hover:shadow-[0_25px_60px_rgba(0,0,0,0.7),_0_0_20px_rgba(255,200,120,0.2)]" style={{ letterSpacing: "0.02em" }}>
            <div className="relative flex items-center w-[170px] justify-start gap-4">
                <svg className="w-[18px] h-[18px] shrink-0 fill-current text-white/[0.85]" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                <span className="text-[17px]">Play vs People</span>
            </div>
        </Link>
    )
}

export function PrimaryHeroButton() {
    return (
        <Link href="/play/katago" className="group relative flex h-[58px] w-full mt-[14px] items-center justify-center rounded-[18px] border border-white/[0.15] bg-white/[0.08] font-medium text-white/[0.85] transition-all duration-300 hover:-translate-y-[2px] hover:scale-[1.01] hover:bg-white/[0.12] hover:shadow-[0_15px_30px_rgba(0,0,0,0.4)]" style={{ letterSpacing: "0.02em" }}>
            <div className="relative flex items-center w-[170px] justify-start gap-4">
                <svg className="w-[18px] h-[18px] shrink-0 fill-current text-white/[0.85]" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                <span className="text-[17px]">Play vs AI</span>
            </div>
        </Link>
    )
}

export function TuitionHeroButton() {
    return (
        <Link href="/play/katago?tuition=true" className="mt-4 flex h-[58px] w-full items-center justify-center gap-2 rounded-[18px] border border-white/10 bg-white/[0.04] text-[18px] font-medium text-white/90 shadow-[inset_0_1px_0_rgba(255,255,255,0.12)] transition hover:bg-white/[0.08] hover:-translate-y-px">
            <svg className="w-[18px] h-[18px] text-[#D9A35F]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>
            Tuition Mode
        </Link>
    )
}

export function SecondaryHeroButton() {
    return (
        <Link href="/watch" className="mt-4 flex h-[58px] w-full items-center justify-center gap-2 rounded-[18px] border border-transparent hover:border-white/5 bg-transparent text-[16px] font-medium text-white/60 transition hover:bg-white/[0.03] hover:-translate-y-px">
            <svg className="w-4 h-4 text-white/50" fill="none" viewBox="0 0 24 24" stroke="currentColor"><circle cx="12" cy="12" r="10" strokeWidth="2" /><circle cx="12" cy="12" r="4" strokeWidth="2" /></svg>
            Analyze with AI
        </Link>
    )
}

export function HeroPanelContent({ hasPlayed, boardState }: { hasPlayed: boolean, boardState: any }) {
    const router = useRouter();

    const handleContinueGame = () => {
        if (boardState) {
            sessionStorage.setItem('heroBoardState', JSON.stringify(boardState));
        }
        // Directing to katago with bot id 'sprout' (Rank 20k / 'Medium' style level as requested)
        router.push('/play/katago?auto=true&continue=hero&bot=sprout');
    };

    return (
        <div className="relative z-10 w-full mb-2 flex flex-col gap-3">
            <h1 className="text-[clamp(24px,2.5vw,34px)] font-semibold tracking-[-0.02em] leading-[1.15] flex flex-col gap-1.5 md:gap-1">
                <span style={{ color: "rgba(255,255,255,0.75)" }}>Play real opponents.</span>
                <span style={{ color: "rgba(255,255,255,0.9)" }}>Train with AI.</span>
                <span className="bg-clip-text text-transparent w-fit md:w-auto" style={{ backgroundImage: "linear-gradient(90deg, #ffffff, #ffd89c)" }}>Master the game.</span>
            </h1>

            <AnimatePresence mode="wait">
                {hasPlayed && (
                    <motion.div
                        initial={{ opacity: 0, height: 0, y: -10 }}
                        animate={{ opacity: 1, height: "auto", y: 0 }}
                        exit={{ opacity: 0, height: 0 }}
                        className="mt-2 text-white/70 text-[15px] font-medium flex items-center gap-2 overflow-hidden"
                    >
                        <span className="w-2 h-2 rounded-full bg-[#D9A35F] animate-pulse"></span>
                        You've engaged the AI.
                    </motion.div>
                )}
            </AnimatePresence>

            <div className="mt-7 w-full flex flex-col gap-0 border-t border-transparent relative">
                <AnimatePresence mode="wait">
                    {hasPlayed ? (
                        <motion.button
                            key="continue"
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            transition={{ duration: 0.4 }}
                            onClick={handleContinueGame}
                            className="group relative flex h-[58px] w-full items-center justify-center gap-3 rounded-[18px] border border-[#D9A35F]/30 bg-[linear-gradient(180deg,#b57a36,#8c5922)] font-semibold text-white shadow-[0_25px_50px_rgba(0,0,0,0.6),inset_0_1px_0_rgba(255,255,255,0.2)] transition-all duration-300 hover:-translate-y-[3px] hover:scale-[1.01] hover:shadow-[0_35px_70px_rgba(0,0,0,0.7)]" style={{ letterSpacing: "0.02em" }}
                        >
                            <span className="absolute inset-0 rounded-[18px] bg-[linear-gradient(90deg,transparent,rgba(255,210,150,0.15),transparent)] opacity-70" />
                            <svg className="relative w-5 h-5 fill-current text-white/90" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                            <span className="relative">Continue Game</span>
                        </motion.button>
                    ) : (
                        <motion.div
                            key="initial"
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            transition={{ duration: 0.4 }}
                            className="flex flex-col w-full"
                        >
                            <MultiplayerHeroButton />
                            <PrimaryHeroButton />
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    )
}

export function HeroPanel({ hasPlayed, boardState }: { hasPlayed: boolean, boardState: any }) {
    return (
        <div
            className="relative z-40 w-full max-w-[420px] mt-4 lg:mt-0 translate-y-0 lg:translate-y-[40px] xl:translate-y-[65px] flex flex-col justify-start"
            style={{ minHeight: "480px" }}
        >
            <div className="-mb-12 w-full flex justify-center lg:justify-start relative z-50">
                {/* Logo glow */}
                <div className="absolute top-[40%] left-1/2 lg:left-[calc(50%-48px)] -translate-x-1/2 -translate-y-1/2 pointer-events-none" style={{ width: "140px", height: "140px", background: "radial-gradient(circle, rgba(255,200,120,0.35), transparent 70%)", filter: "blur(25px)" }} />
                <img src="/img/kai_logo.png" alt="KAI" className="relative z-10 w-[560px] max-w-[160%] lg:-ml-24 drop-shadow-2xl object-contain opacity-95" />
            </div>
            <div
                className="relative w-full rounded-[28px] border border-white/[0.12] px-7 py-[30px] backdrop-blur-[30px] overflow-hidden"
                style={{
                    height: "380px",
                    background: "linear-gradient(160deg, rgba(70,55,40,0.55), rgba(25,22,18,0.45))",
                    boxShadow: "0 40px 90px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.18), inset 0 -1px 0 rgba(0,0,0,0.2)"
                }}
            >
                {/* Glass thickness internal rim */}
                <div className="absolute inset-0 pointer-events-none rounded-[28px]" style={{ boxShadow: "inset 0 2px 6px rgba(255,255,255,0.12), inset 0 -6px 20px rgba(0,0,0,0.35)" }} />
                {/* Inner highlight */}
                <div className="absolute inset-0 pointer-events-none rounded-[28px]" style={{ background: "radial-gradient(circle at 20% 20%, rgba(255,220,160,0.18), transparent 30%), radial-gradient(circle at 70% 10%, rgba(255,200,140,0.10), transparent 25%)" }} />
                <HeroPanelContent hasPlayed={hasPlayed} boardState={boardState} />
            </div>
        </div>
    )
}

export function HeroMainStage() {
    const [hasPlayed, setHasPlayed] = useState(false);
    const [boardState, setBoardState] = useState(null);

    return (
        <div className="relative z-20 w-full flex-1 flex flex-col justify-start pt-0 pb-[100px] lg:pb-[200px] overflow-visible">
            <div className="mx-auto w-full max-w-[1400px] px-6 lg:px-12 flex flex-col lg:flex-row items-end justify-between gap-12 lg:gap-8">
                <HeroPanel hasPlayed={hasPlayed} boardState={boardState} />
                <div className="relative z-20 flex-1 flex justify-center lg:justify-end shrink-0 w-full right-0 lg:right-[16%] xl:right-[22%] mb-8 lg:mb-0">
                    <HeroBoard onFirstMove={() => setHasPlayed(true)} onBoardUpdate={setBoardState} />
                </div>
            </div>

            <button
                onClick={() => document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })}
                className="absolute bottom-4 lg:bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center animate-bounce opacity-80 z-40 hover:opacity-100 transition-opacity cursor-pointer group"
            >
                <span className="text-[#D9A35F] text-[12px] uppercase tracking-[0.25em] mb-3 font-semibold drop-shadow-md group-hover:text-white transition-colors">Explore the world of Go</span>
                <svg className="w-6 h-6 text-[#D9A35F] drop-shadow-md group-hover:translate-y-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 9l-7 7-7-7" />
                </svg>
            </button>
        </div>
    )
}

interface GlassCardProps {
    title: string;
    subtitle: string;
    cta: string;
    href: string;
    icon: React.ReactNode;
}

export function GlassCard({ title, subtitle, cta, href, icon }: GlassCardProps) {
    return (
        <Link
            href={href}
            className="group flex flex-col justify-between rounded-[22px] border border-white/10 bg-gradient-to-b from-white/[0.06] to-white/[0.03] backdrop-blur-[18px] p-6 transition-transform duration-300 hover:-translate-y-[3px] shadow-[0_16px_34px_rgba(0,0,0,0.20),inset_0_1px_0_rgba(255,255,255,0.10)] min-h-[185px]"
        >
            <div>
                <div className="flex items-center gap-3 mb-3">
                    <div className="flex shrink-0 items-center justify-center w-8 h-8">
                        {icon}
                    </div>
                    <h3 className="text-white/[0.92] text-[20px] font-semibold tracking-tight">{title}</h3>
                </div>
                <p className="text-white/60 text-[14px] mb-5 leading-[1.4] pr-4">{subtitle}</p>
            </div>

            <div className="w-full rounded-[14px] border border-white/[0.14] bg-white/[0.06] py-[10px] px-4 text-center text-white/80 text-[14px] font-semibold transition-colors duration-300 group-hover:bg-white/[0.1]">
                {cta}
            </div>
        </Link>
    )
}

export function HeroFeatureRow() {
    return (
        <div id="features" className="relative z-30 mx-auto w-full max-w-[1400px] px-6 lg:px-12 pb-24 mt-8 lg:mt-24 xl:mt-32">
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
                <GlassCard
                    title="Play vs People"
                    subtitle="Real-time online matches"
                    cta="Start Match"
                    href="/play/online"
                    icon={
                        <div className="flex relative w-7 h-5 items-center">
                            <div className="absolute left-0 w-3.5 h-3.5 bg-gradient-to-br from-gray-600 to-black rounded-full shadow-md border border-white/5 z-10" />
                            <div className="absolute left-[10px] w-3.5 h-3.5 bg-gradient-to-br from-white to-gray-300 rounded-full shadow-md border border-black/10 z-0" />
                        </div>
                    }
                />
                <GlassCard
                    title="Play vs AI"
                    subtitle="Challenge KataGo directly"
                    cta="Play KataGo"
                    href="/play/katago"
                    icon={
                        <div className="relative w-[22px] h-[22px] rounded-full border border-white/20 bg-black/40 flex items-center justify-center shadow-[inset_0_0_8px_rgba(255,255,255,0.1)]">
                            <div className="w-2 h-2 bg-white/90 rounded-full shadow-[0_0_8px_rgba(255,255,255,0.8)]" />
                        </div>
                    }
                />
                <GlassCard
                    title="Watch Games"
                    subtitle="Top players in action"
                    cta="Live Matches"
                    href="/watch"
                    icon={
                        <div className="relative w-6 h-6 flex items-center justify-center">
                            <div className="absolute w-[22px] h-[22px] rounded-full border border-white/20" />
                            <div className="absolute w-2.5 h-2.5 rounded-full border border-white/40" />
                            <div className="w-1 h-1 bg-white/90 rounded-full" />
                        </div>
                    }
                />
                <GlassCard
                    title="Analysis Board"
                    subtitle="Free play & manual analysis"
                    cta="Open Board"
                    href="/play/analysis"
                    icon={
                        <div className="flex items-end gap-[3px] h-4">
                            <div className="w-1.5 h-2 bg-white/40 rounded-[1px]" />
                            <div className="w-1.5 h-3 bg-white/60 rounded-[1px]" />
                            <div className="w-1.5 h-4 bg-white/90 rounded-[1px] shadow-[0_0_6px_rgba(255,255,255,0.4)]" />
                        </div>
                    }
                />
                <GlassCard
                    title="Tsumego"
                    subtitle="Daily reading challenges"
                    cta="Solve Puzzles"
                    href="/tsumego"
                    icon={
                        <div className="grid grid-cols-2 gap-1 w-[18px] h-[18px] rotate-45">
                            <div className="w-1.5 h-1.5 rounded-full bg-white/90" />
                            <div className="w-1.5 h-1.5 rounded-full bg-black/60 shadow-inner border border-white/20" />
                            <div className="w-1.5 h-1.5 rounded-full bg-transparent" />
                            <div className="w-1.5 h-1.5 rounded-full bg-white/90" />
                        </div>
                    }
                />
                <GlassCard
                    title="Learn Go"
                    subtitle="Interactive tutorials"
                    cta="Start Learning"
                    href="/learn"
                    icon={
                        <div className="relative w-[20px] h-[18px] border border-white/30 rounded-[2px] flex overflow-hidden">
                            <div className="w-1/2 h-full border-r border-white/20 bg-white/5" />
                            <div className="w-1/2 h-full bg-white/5" />
                            <div className="absolute inset-y-0 left-1/2 w-[1px] bg-white/50" />
                        </div>
                    }
                />
            </div>
        </div>
    )
}

export default function HeroScene() {
    return (
        <section className="relative min-h-[100vh] w-full overflow-hidden bg-[#0A0807] font-sans selection:bg-[#D9A35F]/30 border-b border-white/5">
            <HeroBackground />
            <div className="relative z-10 w-full min-h-screen flex flex-col justify-between pt-[10px] lg:pt-0">
                <HeroMainStage />
                <HeroFeatureRow />
            </div>
        </section>
    )
}
