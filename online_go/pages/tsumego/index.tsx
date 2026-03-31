import React, { useEffect, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { ChevronLeft, CheckCircle2, XCircle, Lightbulb, AlertTriangle } from 'lucide-react';

type Puzzle = {
    id: string;
    source_key: string;
    board_width: number;
    board_height: number;
    to_play: 'B' | 'W';
    goal_type: string | null;
    difficulty_source: string | null;
    tags: string[];
    collection_name: string | null;
    difficulty_level?: number;
    difficulty_rank?: string;
    is_solved_by_user?: boolean;
    title?: string;
    user_progress?: {
        status: 'passed_clean' | 'passed_with_hint' | 'passed_with_errors' | 'failed' | 'unattempted';
        time_spent_seconds: number;
    };
};

type Category = {
    id: string;
    name: string;
    description: string;
    image: string;
};

const CATEGORIES: Category[] = [
    { id: 'life_and_death', name: 'Life & Death', description: 'Master the fundamentals of surviving or killing groups.', image: '/images/categories/life_and_death.png' },
    { id: 'tesuji', name: 'Tesuji', description: 'Discover brilliant tactical moves and clever cuts.', image: '/images/categories/tesuji.png' },
    { id: 'semeai', name: 'Capturing Race', description: 'Win the fierce race for liberties on the edge.', image: '/images/categories/semeai.png' },
    { id: 'endgame', name: 'Endgame (Yose)', description: 'Maximize your territory through precise calculation.', image: '/images/categories/endgame.png' },
    { id: 'advanced', name: 'Advanced (Dan Level)', description: 'Profound, professional-level puzzles spanning all tactical domains.', image: '/images/categories/advanced.png' }
];

export default function TsumegoLibrary() {
    const router = useRouter();
    const [puzzles, setPuzzles] = useState<Puzzle[]>([]);
    const [loading, setLoading] = useState(false);
    const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
    const [continuingCollection, setContinuingCollection] = useState<string | null>(null);

    const handleContinuePractice = async (collectionName: string) => {
        try {
            setContinuingCollection(collectionName);
            const token = localStorage.getItem('token');
            const headers: HeadersInit = { 'Content-Type': 'application/json' };
            if (token) headers['Authorization'] = `Bearer ${token}`;

            const res = await fetch(`http://89.167.122.76:8800/v1/tsumego/practice/next?collection_name=${encodeURIComponent(collectionName)}`, { headers });
            const data = await res.json();
            if (data && data.next_puzzle_id) {
                router.push(`/tsumego/${data.next_puzzle_id}`);
            } else {
                setContinuingCollection(null);
            }
        } catch (err) {
            console.error("Failed to fetch next practice puzzle", err);
            setContinuingCollection(null);
        }
    };

    useEffect(() => {
        if (!selectedCategory) return;
        setLoading(true);

        const token = localStorage.getItem('token');
        const headers: HeadersInit = {
            'Content-Type': 'application/json'
        };
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }

        fetch(`http://89.167.122.76:8800/v1/tsumego/puzzles?goal_type=${selectedCategory.id}`, { headers })
            .then((res) => res.json())
            .then((data) => {
                setPuzzles(data || []);
                setLoading(false);
            })
            .catch((err) => {
                console.error("Error fetching puzzles:", err);
                setLoading(false);
            });
    }, [selectedCategory]);

    return (
        <div className="min-h-screen bg-[#111111] text-[#FAFAFC] selection:bg-[#E9C46A] font-sans">
            <Head>
                <title>Tsumego Collections - KAI</title>
            </Head>

            {/* MAIN CONTENT */}
            <main className="pt-24 pb-24 px-6 min-h-screen flex flex-col">
                <div className="max-w-7xl mx-auto w-full flex-1">

                    {!selectedCategory ? (
                        <>
                            <div className="mb-16 text-center max-w-3xl mx-auto">
                                <h1 className="text-4xl md:text-6xl font-semibold tracking-tight mb-6 bg-gradient-to-br from-white to-gray-400 bg-clip-text text-transparent">
                                    Master the Game
                                </h1>
                                <p className="text-[#8B8B8B] text-lg md:text-xl leading-relaxed mb-10">
                                    Choose a category to practice. From basic life and death to advanced tesuji, our adaptive Elo system will find the perfect puzzles for your rank.
                                </p>

                                <div className="flex justify-center">
                                    <Link href="/tsumego/mix" className="inline-flex bg-gradient-to-r from-[#D9A85B] to-[#C08B3E] text-black px-8 py-4 rounded-xl font-bold hover:scale-105 transition-transform items-center gap-3 shadow-xl shadow-[#D9A85B]/20 text-lg">
                                        Start Adaptive Mix
                                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
                                    </Link>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-7xl mx-auto">
                                {CATEGORIES.map(category => (
                                    <div
                                        key={category.id}
                                        onClick={() => setSelectedCategory(category)}
                                        className="group relative cursor-pointer overflow-hidden rounded-3xl border border-white/10 bg-[#1A1A1A] hover:border-white/30 transition-all duration-500 hover:shadow-2xl hover:shadow-black/50 hover:-translate-y-1"
                                    >
                                        <div className="aspect-[4/3] w-full relative">
                                            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent z-10 transition-opacity duration-500 group-hover:opacity-60" />
                                            <img
                                                src={category.image}
                                                alt={category.name}
                                                className="w-full h-full object-cover transform transition-transform duration-700 group-hover:scale-105"
                                            />
                                            <div className="absolute bottom-0 left-0 p-8 z-20 w-full">
                                                <h3 className="text-2xl md:text-3xl font-semibold text-white mb-2 tracking-tight group-hover:text-[#E9C46A] transition-colors">
                                                    {category.name}
                                                </h3>
                                                <p className="text-gray-300 text-sm md:text-base opacity-90">
                                                    {category.description}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </>
                    ) : (
                        <>
                            {/* PUZZLE GRID HEADER */}
                            <div className="mb-12">
                                <button
                                    onClick={() => setSelectedCategory(null)}
                                    className="flex items-center gap-2 text-sm text-[#8B8B8B] hover:text-white mb-8 transition-colors"
                                >
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                                    </svg>
                                    Back to Collections
                                </button>

                                <div className="flex items-center gap-6">
                                    <img src={selectedCategory.image} className="w-20 h-20 rounded-2xl object-cover shadow-lg" alt={selectedCategory.name} />
                                    <div>
                                        <h1 className="text-4xl font-semibold tracking-tight mb-2 text-white">{selectedCategory.name}</h1>
                                        <p className="text-[#8B8B8B] text-lg">{selectedCategory.description}</p>
                                    </div>
                                </div>
                            </div>

                            {/* PUZZLE GRID */}
                            {loading ? (
                                <div className="flex items-center justify-center h-64">
                                    <div className="w-10 h-10 border-4 border-white/10 border-t-[#E9C46A] rounded-full animate-spin"></div>
                                </div>
                            ) : puzzles.length === 0 ? (
                                <div className="text-center py-24 bg-[#1A1A1A] rounded-3xl border border-white/5">
                                    <p className="text-[#8B8B8B] text-lg">No puzzles found in this category yet. Run the ingestion worker to populate the database.</p>
                                </div>
                            ) : (
                                <div className="space-y-12">
                                    {/* PUZZLE GRID START */}

                                    {Object.entries(
                                        puzzles.reduce((acc, puzzle) => {
                                            const key = puzzle.collection_name || 'Uncategorized';
                                            if (!acc[key]) acc[key] = [];
                                            acc[key].push(puzzle);
                                            return acc;
                                        }, {} as Record<string, Puzzle[]>)
                                    ).map(([collectionName, collectionPuzzles]) => (
                                        <div key={collectionName} className="space-y-6">
                                            <h2 className="text-2xl font-medium tracking-tight text-white/90 border-b border-white/10 pb-2 flex items-center justify-between">
                                                <div>
                                                    {collectionName} <span className="text-[#8B8B8B] text-base ml-2">({collectionPuzzles.length})</span>
                                                </div>
                                                <button
                                                    onClick={() => handleContinuePractice(collectionName)}
                                                    disabled={continuingCollection === collectionName}
                                                    className="text-sm font-semibold bg-[#E9C46A] hover:bg-[#d4b059] text-black px-4 py-1.5 rounded-full transition shadow-lg disabled:opacity-50 flex items-center gap-2"
                                                >
                                                    {continuingCollection === collectionName ? 'Loading...' : 'Continue'}
                                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
                                                </button>
                                            </h2>
                                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                                                {collectionPuzzles.map((puzzle, idx) => (
                                                    <Link key={puzzle.id} href={`/tsumego/${puzzle.id}`}>
                                                        <div className={`p-4 bg-[#1A1A1A] rounded-xl border ${puzzle.user_progress?.status === 'passed_clean' ? 'border-[#47a479]/50' : puzzle.user_progress?.status === 'passed_with_hint' ? 'border-[#E9C46A]/50' : puzzle.user_progress?.status === 'passed_with_errors' ? 'border-[#f97316]/50' : puzzle.user_progress?.status === 'failed' ? 'border-red-500/50' : 'border-white/5'} hover:border-white/30 hover:bg-white-[0.02] flex items-center justify-between transition-all duration-200 group cursor-pointer`}>

                                                            <div className="flex items-center gap-5 w-2/3">
                                                                <div className={`flex items-center justify-center w-10 h-10 rounded-full flex-shrink-0 shadow-lg ${puzzle.user_progress?.status === 'passed_clean' ? 'bg-[#47a479]/20 text-[#47a479]' : puzzle.user_progress?.status === 'passed_with_hint' ? 'bg-[#E9C46A]/20 text-[#E9C46A]' : puzzle.user_progress?.status === 'passed_with_errors' ? 'bg-[#f97316]/20 text-[#f97316]' : puzzle.user_progress?.status === 'failed' ? 'bg-red-500/20 text-red-500' : 'bg-[#2A2A2A] text-[#555]'}`}>
                                                                    {puzzle.user_progress?.status === 'passed_clean' ? (
                                                                        <CheckCircle2 className="w-5 h-5" />
                                                                    ) : puzzle.user_progress?.status === 'passed_with_hint' ? (
                                                                        <div className="relative">
                                                                            <CheckCircle2 className="w-5 h-5 opacity-50" />
                                                                            <Lightbulb className="w-3 h-3 absolute -top-1 -right-1 text-[#E9C46A]" />
                                                                        </div>
                                                                    ) : puzzle.user_progress?.status === 'passed_with_errors' ? (
                                                                        <div className="relative">
                                                                            <CheckCircle2 className="w-5 h-5 opacity-50" />
                                                                            <AlertTriangle className="w-3 h-3 absolute -top-1 -right-1 text-[#f97316]" />
                                                                        </div>
                                                                    ) : puzzle.user_progress?.status === 'failed' ? (
                                                                        <XCircle className="w-5 h-5" />
                                                                    ) : (
                                                                        <span className="text-xs font-bold">{idx + 1}</span>
                                                                    )}
                                                                </div>

                                                                <div className="flex flex-col truncate">
                                                                    <div className="flex items-center gap-3">
                                                                        <h3 className="font-semibold text-white/90 truncate">{puzzle.title || `Problem #${idx + 1}`}</h3>
                                                                        <span className="text-xs px-2 py-0.5 rounded-full border border-white/10 bg-[#111] text-[#8B8B8B] tracking-wide font-medium">
                                                                            {puzzle.difficulty_rank || '10k'}
                                                                        </span>
                                                                    </div>
                                                                    <div className="flex items-center gap-2 mt-1 truncate">
                                                                        <span className="text-xs text-[#8B8B8B] flex items-center gap-1">
                                                                            <div className={`w-2 h-2 rounded-full ${puzzle.to_play === 'B' ? 'bg-black border border-white/20' : 'bg-white'}`}></div>
                                                                            {puzzle.to_play === 'B' ? 'Black to Play' : 'White to Play'}
                                                                        </span>
                                                                        {puzzle.tags && puzzle.tags.length > 0 && (
                                                                            <>
                                                                                <span className="text-white/20 text-xs">•</span>
                                                                                <span className="text-xs text-[#8B8B8B] truncate opacity-70">
                                                                                    {puzzle.tags.map(t => t.replace(/_/g, ' ')).join(', ')}
                                                                                </span>
                                                                            </>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            </div>

                                                            <div className="flex items-center gap-4 text-sm font-medium w-1/3 justify-end shrink-0">
                                                                {puzzle.user_progress?.status === 'passed_clean' && (
                                                                    <span className="text-[#47a479] text-xs">Passed ({puzzle.user_progress.time_spent_seconds}s)</span>
                                                                )}
                                                                {puzzle.user_progress?.status === 'passed_with_hint' && (
                                                                    <span className="text-[#E9C46A] text-xs">Passed w/ Hint</span>
                                                                )}
                                                                {puzzle.user_progress?.status === 'passed_with_errors' && (
                                                                    <span className="text-[#f97316] text-xs">Passed w/ Errors ({puzzle.user_progress.time_spent_seconds}s)</span>
                                                                )}
                                                                {puzzle.user_progress?.status === 'failed' && (
                                                                    <span className="text-red-500 text-xs">Failed</span>
                                                                )}
                                                                <ChevronLeft className="w-5 h-5 text-[#444] group-hover:text-white/80 transition-colors transform rotate-180" />
                                                            </div>
                                                        </div>
                                                    </Link>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </>
                    )}
                </div>
            </main>
        </div>
    );
}
