import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { Eye, Clock, Users, Activity } from 'lucide-react';
import GlobalHeader from '../../components/GlobalHeader';
import { motion } from 'framer-motion';

export default function WatchLiveGames() {
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMatches = async () => {
      try {
        const res = await fetch('http://localhost:8800/v1/matches/live');
        if (res.ok) {
          const data = await res.json();
          setMatches(data);
        }
      } catch (error) {
        console.error("Failed to fetch live matches", error);
      } finally {
        setLoading(false);
      }
    };

    fetchMatches();
    // Poll every 10 seconds
    const interval = setInterval(fetchMatches, 10000);
    return () => clearInterval(interval);
  }, []);

  const formatPreset = (preset) => {
    if (preset === 'blitz') return 'Blitz (5m)';
    if (preset === 'rapid') return 'Rapid (15m)';
    if (preset === 'standard') return 'Standard (30m)';
    return preset;
  };

  return (
    <div className="min-h-screen bg-[#F8F9FA] text-gray-900 font-sans">
      <Head>
        <title>Watch Live Games | Online-Go</title>
      </Head>

      <GlobalHeader />

      <main className="max-w-[1200px] mx-auto pt-32 pb-16 px-6">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-12 h-12 bg-[#E5F1EB] rounded-2xl flex items-center justify-center text-[#4CAF84]">
            <Activity className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Live Matches</h1>
            <p className="text-gray-500 font-medium mt-1">Spectate ongoing Go games in real-time</p>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center items-center h-48">
            <div className="w-8 h-8 border-4 border-[#4CAF84]/20 border-t-[#4CAF84] rounded-full animate-spin"></div>
          </div>
        ) : matches.length === 0 ? (
          <div className="bg-white rounded-[24px] border border-gray-100 p-12 text-center shadow-sm">
            <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4 text-gray-400">
              <Eye className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-bold mb-2">No Live Matches</h3>
            <p className="text-gray-500 max-w-sm mx-auto">There are currently no active games to spectate. Check back later or start a match yourself!</p>
            <Link href="/play" className="inline-flex items-center gap-2 px-6 py-3 bg-[#1A1A1A] text-white rounded-xl font-bold mt-6 hover:bg-black transition-colors">
              Play Now
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {matches.map((match, i) => (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                key={match.id}
              >
                <Link href={`/watch/${match.id}`} className="block group">
                  <div className="bg-white rounded-[24px] border border-gray-100 p-6 shadow-sm hover:shadow-xl transition-all duration-300 relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#4CAF84] to-blue-500 opacity-0 group-hover:opacity-100 transition-opacity" />

                    <div className="flex justify-between items-start mb-6">
                      <div className="flex items-center gap-2">
                        <span className="px-2.5 py-1 bg-red-50 text-red-600 rounded-lg text-[11px] font-bold uppercase tracking-wider flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
                          LIVE
                        </span>
                        <span className="px-2.5 py-1 bg-gray-50 text-gray-600 rounded-lg text-[11px] font-bold uppercase tracking-wider">
                          {match.board_size}x{match.board_size}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 bg-gray-50 px-2.5 py-1 rounded-lg">
                        <Clock className="w-3.5 h-3.5" />
                        {formatPreset(match.time_preset)}
                      </div>
                    </div>

                    <div className="flex items-center justify-between mt-4">
                      {/* Black Player */}
                      <div className="flex flex-col items-center flex-1">
                        <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mb-2 shadow-inner">
                          <div className="w-7 h-7 bg-black rounded-full shadow-[inset_2px_4px_4px_rgba(255,255,255,0.2)]" />
                        </div>
                        <span className="font-bold text-[14px] truncate w-full text-center">{match.black_player}</span>
                        <span className="text-[11px] text-gray-500 font-medium">{match.black_rating} ELO</span>
                      </div>

                      <div className="px-4 text-gray-300 font-bold text-lg">VS</div>

                      {/* White Player */}
                      <div className="flex flex-col items-center flex-1">
                        <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mb-2 shadow-inner">
                          <div className="w-7 h-7 bg-white rounded-full shadow-[0_2px_4px_rgba(0,0,0,0.1),inset_2px_4px_4px_rgba(255,255,255,0.8)]" />
                        </div>
                        <span className="font-bold text-[14px] truncate w-full text-center">{match.white_player}</span>
                        <span className="text-[11px] text-gray-500 font-medium">{match.white_rating} ELO</span>
                      </div>
                    </div>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}