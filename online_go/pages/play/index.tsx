import React from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { Cpu, Users, ChevronLeft, ArrowRight } from 'lucide-react';
import { motion } from 'framer-motion';

export default function PlayModeSelection() {
    const router = useRouter();

    return (
        <div className="w-full bg-[#111111] text-[#FAFAFC] selection:bg-[#E9C46A] min-h-[calc(100vh-4rem)] sm:min-h-[calc(100vh-5rem)] flex flex-col pt-16 sm:pt-20">
            <Head>
                <title>Play - KAI</title>
            </Head>

            {/* SUB-HEADER */}
            <div className="w-full bg-[#111111] border-b border-white/5 z-40 relative">
                <div className="max-w-[1400px] mx-auto px-6 h-12 flex items-center">
                    <Link href="/" className="text-[#8B8B8B] hover:text-white transition-colors flex items-center gap-2 text-sm font-medium">
                        <ChevronLeft className="w-4 h-4" /> Home
                    </Link>
                </div>
            </div>

            {/* MAIN CONTENT AREA */}
            <main className="flex-1 w-full max-w-[1000px] mx-auto px-4 sm:px-6 pt-12 pb-12 flex flex-col items-center">

                <div className="text-center mb-12">
                    <h1 className="text-4xl font-semibold tracking-tight text-white mb-3">Play Go</h1>
                    <p className="text-[#8B8B8B] text-lg max-w-lg mx-auto">Choose your opponent and start playing immediately. No complicated setup required.</p>
                </div>

                <div className="flex flex-col md:flex-row gap-6 w-full max-w-[800px] justify-center">

                    {/* KATAGO CARD */}
                    <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => router.push('/play/katago')}
                        className="flex-1 bg-[#1A1A1A] border border-white/5 hover:border-[#E9C46A]/50 rounded-2xl p-8 flex flex-col items-start text-left transition-all shadow-xl hover:shadow-[0_0_40px_rgba(233,196,106,0.1)] group relative overflow-hidden"
                    >
                        <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
                            <Cpu className="w-32 h-32" />
                        </div>

                        <div className="w-14 h-14 rounded-2xl bg-[#E9C46A]/10 text-[#E9C46A] flex items-center justify-center mb-6">
                            <Cpu className="w-7 h-7" />
                        </div>

                        <h2 className="text-2xl font-semibold text-white mb-2">Play with KataGo</h2>
                        <p className="text-[#8B8B8B] mb-8 leading-relaxed">Start instantly against our powerful AI engine. Analyze your moves in real-time and improve your game.</p>

                        <div className="mt-auto flex items-center gap-2 text-[#E9C46A] font-medium group-hover:translate-x-1 transition-transform">
                            Play KataGo <ArrowRight className="w-4 h-4" />
                        </div>
                    </motion.button>

                    {/* ANOTHER PLAYER CARD */}
                    <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => {
                            const token = localStorage.getItem('token');
                            if (!token || token === 'undefined' || token === 'null') {
                                alert("Please log in to play against other players.");
                                router.push('/login');
                            } else {
                                router.push('/play/online');
                            }
                        }}
                        className="flex-1 bg-gradient-to-br from-[#1A1A1A] to-[#111111] border border-white/5 hover:border-blue-500/50 rounded-2xl p-8 flex flex-col items-start text-left transition-all shadow-xl hover:shadow-[0_0_40px_rgba(59,130,246,0.15)] group relative overflow-hidden"
                    >
                        <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
                            <Users className="w-32 h-32" />
                        </div>

                        <div className="w-14 h-14 rounded-2xl bg-blue-500/10 text-blue-400 flex items-center justify-center mb-6">
                            <Users className="w-7 h-7" />
                        </div>

                        <h2 className="text-2xl font-semibold text-white mb-2">Another Player</h2>
                        <p className="text-[#8B8B8B] mb-8 leading-relaxed">Find a live opponent near your skill level for a quick match. Instantly pair up and start playing.</p>

                        <div className="mt-auto flex items-center gap-2 text-blue-400 font-medium group-hover:translate-x-1 transition-transform">
                            Quick Match <ArrowRight className="w-4 h-4" />
                        </div>
                    </motion.button>

                </div>
            </main>
        </div>
    );
}
