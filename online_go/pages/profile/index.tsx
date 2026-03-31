import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { ChevronLeft, Trophy, Activity, Target, Clock, LogOut, Swords, Puzzle, History, CheckCircle2, XCircle, AlertTriangle, Settings, Zap, Cpu } from 'lucide-react';
import RatingChart from '../../components/RatingChart';
import { useAuth } from '../../context/AuthContext';

type MatchHistory = { id: number; my_color: string; opponent_name: string; opponent_rank: string; status: string; result: string | null; played_at: string };
type TsumegoHistory = { id: string; problem_id: string; collection_name: string | null; difficulty_rank: string; is_correct: boolean; used_hint: boolean; time_spent_seconds: number; created_at: string };
type PointHistory = { id: string; match_type: string; points_change: number; new_rating: number; created_at: string };

export default function Profile() {
    const { user, isAuthenticated, isLoading, refreshProfile } = useAuth();
    const [history, setHistory] = useState([]);
    const [matches, setMatches] = useState<MatchHistory[]>([]);
    const [puzzles, setPuzzles] = useState<TsumegoHistory[]>([]);
    const [pointLogs, setPointLogs] = useState<PointHistory[]>([]);
    const [activeTab, setActiveTab] = useState<'overview' | 'matches' | 'puzzles' | 'points' | 'settings'>('overview');
    const [selectedLevel, setSelectedLevel] = useState<number>(3);
    const [isSaving, setIsSaving] = useState(false);

    const [loadingHistory, setLoadingHistory] = useState(false);
    const [mounted, setMounted] = useState(false);
    const router = useRouter();

    useEffect(() => {
        setMounted(true);
    }, []);

    useEffect(() => {
        if (user && user.analysis_level) {
            setSelectedLevel(user.analysis_level);
        }
    }, [user]);

    const handleSaveSettings = async () => {
        setIsSaving(true);
        try {
            const token = localStorage.getItem('token');
            const res = await fetch('http://89.167.122.76:8800/v1/users/me/settings', {
                method: 'PATCH',
                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ analysis_level: selectedLevel })
            });
            if (res.ok) {
                if (refreshProfile) await refreshProfile();
                alert('Settings saved successfully!');
            } else {
                alert('Failed to save settings.');
            }
        } catch (e) {
            alert('Error saving settings.');
        } finally {
            setIsSaving(false);
        }
    };

    useEffect(() => {
        if (!isLoading && !isAuthenticated) {
            const token = localStorage.getItem('token');
            if (!token) {
                router.push('/login');
            }
        }
    }, [isLoading, isAuthenticated, router]);

    useEffect(() => {
        const fetchHistory = async () => {
            if (!isAuthenticated) return;
            setLoadingHistory(true);
            try {
                const token = localStorage.getItem('token');
                const headers = { 'Authorization': `Bearer ${token}` };

                const [histRes, matchRes, puzzleRes, pointsRes] = await Promise.all([
                    fetch('http://89.167.122.76:8800/v1/users/me/rating/history', { headers }),
                    fetch('http://89.167.122.76:8800/v1/users/me/games', { headers }),
                    fetch('http://89.167.122.76:8800/v1/users/me/tsumego', { headers }),
                    fetch('http://89.167.122.76:8800/v1/users/me/rating/history/detailed', { headers })
                ]);

                if (histRes.ok) setHistory(await histRes.json());
                if (matchRes.ok) setMatches(await matchRes.json());
                if (puzzleRes.ok) setPuzzles(await puzzleRes.json());
                if (pointsRes.ok) setPointLogs(await pointsRes.json());

            } catch (err) {
                console.error("Failed to load history:", err);
            } finally {
                setLoadingHistory(false);
            }
        };
        fetchHistory();
    }, [isAuthenticated]);

    if (isLoading || !user) {
        return (
            <div className="min-h-screen bg-[#FDFBF7] flex flex-col items-center justify-center p-4">
                <div className="w-8 h-8 border-4 border-[#EAE5D9] border-t-[#2C2C2C] rounded-full animate-spin mb-4"></div>
                {mounted && (
                    <div className="text-red-500 font-mono text-xs max-w-lg w-full text-left break-all bg-red-50 p-4 rounded-lg border border-red-100 shadow-xl mt-4 z-50 overflow-auto">
                        <b>Auth Debugger [Hydration-Safe v2]</b><br />
                        <hr className="my-2 border-red-200" />
                        <div>• isLoading: <b>{String(isLoading)}</b></div>
                        <div>• isAuthenticated: <b>{String(isAuthenticated)}</b></div>
                        <div>• user: <b>{user ? JSON.stringify(user) : 'null'}</b></div>
                        <div>• stored token: <b>{localStorage.getItem('token') ? localStorage.getItem('token')?.substring(0, 30) + '...' : 'Null'}</b></div>
                        <div>• window.location: <b>{window.location.pathname}</b></div>
                    </div>
                )}
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#FDFBF7] text-[#2C2C2C]">
            <Head>
                <title>User Profile - KAI</title>
            </Head>

            <main className="max-w-4xl mx-auto px-6 py-24 w-full flex flex-col gap-8">
                {/* User Header */}
                <div className="flex flex-col md:flex-row gap-6 items-center md:items-start text-center md:text-left">
                    <div className="w-24 h-24 rounded-full bg-gradient-to-br from-[#EAE5D9] to-[#D5CDBD] shadow-md border-4 border-white flex-shrink-0 flex justify-center items-center text-3xl font-bold text-gray-700">
                        {user?.username?.[0]?.toUpperCase() || 'U'}
                    </div>
                    <div className="flex-1">
                        <h1 className="text-3xl font-extrabold tracking-tight">{user?.username || 'Guest'}</h1>
                        <p className="text-gray-500 mt-1 flex items-center justify-center md:justify-start gap-2">
                            <span className="inline-block w-2 h-2 rounded-full bg-green-500"></span> Online
                        </p>
                    </div>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 w-full">
                    <div className="bg-white p-5 rounded-2xl border border-[#EAE5D9] shadow-sm flex flex-col gap-2">
                        <div className="flex items-center gap-2 text-gray-500 text-sm font-medium">
                            <Trophy className="w-4 h-4 text-blue-500" /> Rank
                        </div>
                        <div className="text-2xl font-bold">{user?.rank || '15k'}</div>
                    </div>

                    <div className="bg-white p-5 rounded-2xl border border-[#EAE5D9] shadow-sm flex flex-col gap-2">
                        <div className="flex items-center gap-2 text-gray-500 text-sm font-medium">
                            <Activity className="w-4 h-4 text-green-500" /> Rating
                        </div>
                        <div className="text-2xl font-bold">{user?.rating ?? 1500}</div>
                    </div>

                    <div className="bg-white p-5 rounded-2xl border border-[#EAE5D9] shadow-sm flex flex-col gap-2">
                        <div className="flex items-center gap-2 text-gray-500 text-sm font-medium">
                            <Target className="w-4 h-4 text-orange-500" /> System
                        </div>
                        <div className="text-2xl font-bold">{user?.system_points ?? 0}</div>
                    </div>

                    <div className="bg-white p-5 rounded-2xl border border-[#EAE5D9] shadow-sm flex flex-col gap-2">
                        <div className="flex items-center gap-2 text-gray-500 text-sm font-medium">
                            <Clock className="w-4 h-4 text-purple-500" /> Deviation
                        </div>
                        <div className="text-2xl font-bold">{user?.rating_deviation ?? 350}</div>
                    </div>
                </div>

                {/* Main Content Area */}
                <div className="flex flex-col md:flex-row gap-8 mt-4 w-full">
                    {/* Sidebar Tabs */}
                    <div className="w-full md:w-48 flex flex-col gap-2 shrink-0">
                        <button
                            onClick={() => setActiveTab('overview')}
                            className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-sm font-medium ${activeTab === 'overview' ? 'bg-[#2C2C2C] text-white shadow-md' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'}`}
                        >
                            <Activity className="w-4 h-4" /> Overview
                        </button>
                        <button
                            onClick={() => setActiveTab('matches')}
                            className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-sm font-medium ${activeTab === 'matches' ? 'bg-[#2C2C2C] text-white shadow-md' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'}`}
                        >
                            <Swords className="w-4 h-4" /> Match History
                        </button>
                        <button
                            onClick={() => setActiveTab('puzzles')}
                            className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-sm font-medium ${activeTab === 'puzzles' ? 'bg-[#2C2C2C] text-white shadow-md' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'}`}
                        >
                            <Puzzle className="w-4 h-4" /> Puzzles
                        </button>
                        <button
                            onClick={() => setActiveTab('points')}
                            className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-sm font-medium ${activeTab === 'points' ? 'bg-[#2C2C2C] text-white shadow-md' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'}`}
                        >
                            <History className="w-4 h-4" /> Points Log
                        </button>
                        <button
                            onClick={() => setActiveTab('settings')}
                            className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-sm font-medium ${activeTab === 'settings' ? 'bg-[#2C2C2C] text-white shadow-md' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'}`}
                        >
                            <Settings className="w-4 h-4" /> Settings
                        </button>
                    </div>

                    {/* Tab Content */}
                    <div className="flex-1 min-w-0">
                        {activeTab === 'settings' && (
                            <div className="flex flex-col gap-4">
                                <h2 className="text-xl font-bold border-b border-[#EAE5D9] pb-3 mb-2">Global Settings</h2>
                                <div className="bg-white p-6 rounded-2xl border border-[#EAE5D9] shadow-sm flex flex-col gap-6">
                                    <div>
                                        <h3 className="text-lg font-bold mb-1">KataGo Analysis Depth</h3>
                                        <p className="text-sm text-gray-500 mb-4">Choose the default computational power applied to your post-game reviews and analysis requests.</p>

                                        <div className="flex flex-col gap-3">
                                            {[
                                                { level: 1, name: 'Fast Read', desc: '100 playouts. Instantly quick, but easily misses complex traps.', icon: Zap, color: 'text-yellow-500' },
                                                { level: 2, name: 'Standard', desc: '500 playouts. Solid tactical reading, very reliable locally.', icon: Target, color: 'text-green-500' },
                                                { level: 3, name: 'Deep', desc: '1,500 playouts. Tournament-grade. Extremely strong positional judgment.', icon: Activity, color: 'text-blue-500' },
                                                { level: 4, name: 'Grandmaster', desc: '5,000 playouts. Professional level depth. Rarely misreads entire board combinations.', icon: Trophy, color: 'text-purple-500' },
                                                { level: 5, name: 'AI Oracle', desc: '15,000 playouts. Practically inhuman perfection, but significantly slower.', icon: Cpu, color: 'text-red-500' }
                                            ].map((tier) => {
                                                const Icon = tier.icon;
                                                return (
                                                    <label key={tier.level} className={`flex items-start gap-4 p-4 rounded-xl border-2 cursor-pointer transition-all ${selectedLevel === tier.level ? 'border-[#2C2C2C] bg-gray-50' : 'border-transparent bg-[#FDFBF7] hover:bg-gray-50 hover:border-gray-200'}`}>
                                                        <div className="flex items-center h-5 mt-0.5">
                                                            <input type="radio" name="analysis_level" value={tier.level} checked={selectedLevel === tier.level} onChange={() => setSelectedLevel(tier.level)} className="w-4 h-4 text-black focus:ring-black border-gray-300" />
                                                        </div>
                                                        <div className="flex-1 flex flex-col">
                                                            <span className="font-bold flex items-center gap-2"><Icon className={`w-4 h-4 ${tier.color}`} /> {tier.name}</span>
                                                            <span className="text-sm text-gray-500">{tier.desc}</span>
                                                        </div>
                                                    </label>
                                                )
                                            })}
                                        </div>
                                    </div>

                                    <div className="border-t border-gray-100 pt-4 flex justify-end">
                                        <button
                                            onClick={handleSaveSettings}
                                            disabled={isSaving}
                                            className="px-6 py-2 bg-black text-white font-bold rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50"
                                        >
                                            {isSaving ? 'Saving...' : 'Save Settings'}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeTab === 'overview' && (
                            <div className="flex flex-col gap-4">
                                <h2 className="text-xl font-bold border-b border-[#EAE5D9] pb-3 mb-2">Rating Progression</h2>
                                <div className="bg-white p-6 rounded-2xl border border-[#EAE5D9] shadow-sm">
                                    <RatingChart data={history} />
                                </div>
                            </div>
                        )}

                        {activeTab === 'matches' && (
                            <div className="flex flex-col gap-4">
                                <h2 className="text-xl font-bold border-b border-[#EAE5D9] pb-3 mb-2">Recent Games</h2>
                                <div className="bg-white rounded-2xl border border-[#EAE5D9] shadow-sm overflow-hidden overflow-x-auto">
                                    <table className="w-full text-sm text-left">
                                        <thead className="bg-[#F8F6F0] text-gray-500 font-medium">
                                            <tr>
                                                <th className="px-6 py-4">Date</th>
                                                <th className="px-6 py-4">Opponent</th>
                                                <th className="px-6 py-4">Color</th>
                                                <th className="px-6 py-4">Result</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-[#EAE5D9]">
                                            {matches.length === 0 ? (
                                                <tr><td colSpan={4} className="px-6 py-8 text-center text-gray-400">No recent games found.</td></tr>
                                            ) : matches.map(m => (
                                                <tr key={m.id} className="hover:bg-gray-50 transition-colors">
                                                    <td className="px-6 py-4 whitespace-nowrap text-gray-600">
                                                        {new Date(m.played_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                                                    </td>
                                                    <td className="px-6 py-4 font-medium text-gray-900">
                                                        {m.opponent_name} <span className="text-gray-400 text-xs ml-1">({m.opponent_rank})</span>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full border shadow-sm ${m.my_color === 'B' ? 'bg-black border-gray-700 text-white' : 'bg-white border-gray-300 text-black'}`}>
                                                            {m.my_color}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        {m.status === 'active' ? (
                                                            <span className="text-blue-500 font-medium">In Progress</span>
                                                        ) : (
                                                            <span className={`font-semibold ${m.result && m.result.startsWith(m.my_color) ? 'text-green-600' : 'text-red-500'}`}>
                                                                {m.result || 'Unknown'}
                                                            </span>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}

                        {activeTab === 'puzzles' && (
                            <div className="flex flex-col gap-4">
                                <h2 className="text-xl font-bold border-b border-[#EAE5D9] pb-3 mb-2">Tsumego Attempts</h2>
                                <div className="bg-white rounded-2xl border border-[#EAE5D9] shadow-sm overflow-hidden overflow-x-auto">
                                    <table className="w-full text-sm text-left">
                                        <thead className="bg-[#F8F6F0] text-gray-500 font-medium">
                                            <tr>
                                                <th className="px-6 py-4">Date</th>
                                                <th className="px-6 py-4">Collection</th>
                                                <th className="px-6 py-4">Rank</th>
                                                <th className="px-6 py-4">Status</th>
                                                <th className="px-6 py-4">Time</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-[#EAE5D9]">
                                            {puzzles.length === 0 ? (
                                                <tr><td colSpan={5} className="px-6 py-8 text-center text-gray-400">No recent puzzle attempts.</td></tr>
                                            ) : puzzles.map(p => (
                                                <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                                                    <td className="px-6 py-4 whitespace-nowrap text-gray-600">
                                                        {new Date(p.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                                    </td>
                                                    <td className="px-6 py-4 font-medium text-gray-900">
                                                        {p.collection_name || 'Daily Challenge'}
                                                    </td>
                                                    <td className="px-6 py-4 text-gray-600">
                                                        {p.difficulty_rank || '?'}
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        {p.is_correct && !p.used_hint ? (
                                                            <span className="flex items-center gap-1.5 text-green-600 font-medium"><CheckCircle2 className="w-4 h-4" /> Clean</span>
                                                        ) : p.is_correct && p.used_hint ? (
                                                            <span className="flex items-center gap-1.5 text-yellow-600 font-medium"><AlertTriangle className="w-4 h-4" /> Hinted</span>
                                                        ) : (
                                                            <span className="flex items-center gap-1.5 text-red-500 font-medium"><XCircle className="w-4 h-4" /> Failed</span>
                                                        )}
                                                    </td>
                                                    <td className="px-6 py-4 text-gray-600">
                                                        {p.time_spent_seconds}s
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}

                        {activeTab === 'points' && (
                            <div className="flex flex-col gap-4">
                                <h2 className="text-xl font-bold border-b border-[#EAE5D9] pb-3 mb-2">Points History</h2>
                                <div className="bg-white rounded-2xl border border-[#EAE5D9] shadow-sm overflow-hidden overflow-x-auto">
                                    <table className="w-full text-sm text-left">
                                        <thead className="bg-[#F8F6F0] text-gray-500 font-medium">
                                            <tr>
                                                <th className="px-6 py-4">Date</th>
                                                <th className="px-6 py-4">Activity</th>
                                                <th className="px-6 py-4">Change</th>
                                                <th className="px-6 py-4">New Rating</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-[#EAE5D9]">
                                            {pointLogs.length === 0 ? (
                                                <tr><td colSpan={4} className="px-6 py-8 text-center text-gray-400">No point logs available.</td></tr>
                                            ) : pointLogs.map(pl => (
                                                <tr key={pl.id} className="hover:bg-gray-50 transition-colors">
                                                    <td className="px-6 py-4 whitespace-nowrap text-gray-600">
                                                        {new Date(pl.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                                    </td>
                                                    <td className="px-6 py-4 capitalize font-medium text-gray-900">
                                                        {pl.match_type}
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <span className={`font-bold ${pl.points_change > 0 ? 'text-green-600' : pl.points_change < 0 ? 'text-red-500' : 'text-gray-500'}`}>
                                                            {pl.points_change > 0 ? '+' : ''}{pl.points_change}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4 font-mono font-medium text-gray-800">
                                                        {pl.new_rating}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </main>
        </div>
    );
}
