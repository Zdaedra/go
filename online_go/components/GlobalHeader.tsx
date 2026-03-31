import React, { Fragment } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { LogOut, User } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function GlobalHeader() {
    const router = useRouter();
    const { user, isAuthenticated, isLoading, logout } = useAuth();

    // Some pages shouldn't show the global header or might need a different style
    const isDarkHeader = router.pathname.startsWith('/tsumego/[id]') || router.pathname === '/';

    const handleLogout = () => {
        logout();
    };

    const headerClasses = isDarkHeader
        ? "fixed top-0 left-0 right-0 z-[200] h-16 flex items-center justify-between px-6 bg-black/[0.18] backdrop-blur-[12px] border-b border-white/5 pointer-events-none"
        : "fixed top-0 left-0 right-0 z-[200] h-16 sm:h-20 flex items-center justify-between px-4 sm:px-6 bg-[#FDFCFB]/80 backdrop-blur-xl border-b border-gray-100 pointer-events-none";

    const textLogoClass = isDarkHeader ? "text-white" : "text-gray-900";
    const navTextClass = isDarkHeader ? "text-[#8B8B8B] hover:text-white" : "text-gray-500 hover:text-gray-900";
    const usernameClass = isDarkHeader ? "text-white hover:text-gray-200" : "text-gray-800 hover:text-gray-900";

    return (
        <Fragment>
            <header className={headerClasses}>
                <div className="flex items-center gap-3 pointer-events-auto">
                    <Link href="/" className="flex items-center gap-2 md:gap-3 group hover:opacity-100 transition-opacity">
                        <span
                            className="text-[24px] font-serif tracking-[0.35em] drop-shadow-sm group-hover:scale-[1.03] transition-transform ml-1"
                            style={{
                                background: 'linear-gradient(to bottom right, #fdf1d4, #d9a35f, #a87b3f)',
                                WebkitBackgroundClip: 'text',
                                WebkitTextFillColor: 'transparent',
                            }}
                        >
                            KAI
                        </span>
                    </Link>
                </div>

                <nav className="hidden lg:flex items-center gap-8 pointer-events-auto">
                    <Link href="/play/online" className={`text-[14px] font-medium tracking-wide ${navTextClass} transition-colors`}>Play vs People</Link>
                    <Link href="/play/katago" className={`text-[14px] font-medium tracking-wide ${navTextClass} transition-colors`}>Play vs AI</Link>
                    <Link href="/watch" className={`text-[14px] font-medium tracking-wide ${navTextClass} transition-colors`}>Watch</Link>
                    <Link href="/analysis" className={`text-[14px] font-medium tracking-wide ${navTextClass} transition-colors`}>Review</Link>
                    <Link href="/tsumego" className={`text-[14px] font-medium tracking-wide ${navTextClass} transition-colors`}>Puzzles</Link>
                    <Link href="/learn/rules" className={`text-[14px] font-medium tracking-wide ${navTextClass} transition-colors`}>Learn</Link>
                </nav>

                <div className="flex items-center gap-4 sm:gap-6 pointer-events-auto">
                    {isAuthenticated && user && (
                        <div className="flex items-center gap-4">
                            <Link href="/profile" className={`flex items-center gap-2 text-[14px] font-semibold ${usernameClass} transition-colors`}>
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${isDarkHeader ? 'bg-white/10 text-white' : 'bg-gray-100 text-gray-700'}`}>
                                    {user.username.charAt(0).toUpperCase()}
                                </div>
                                <span className="hidden sm:inline">{user.username}</span>
                            </Link>
                            <button
                                onClick={handleLogout}
                                className={`p-2 rounded-full transition-colors ${isDarkHeader ? 'text-gray-400 hover:text-red-400 hover:bg-red-400/10' : 'text-gray-400 hover:text-red-500 hover:bg-red-50'}`}
                                title="Log out"
                            >
                                <LogOut className="w-4 h-4" />
                            </button>
                        </div>
                    )}

                    {!isAuthenticated && !user && (
                        <div className="flex items-center gap-3">
                            <Link
                                href="/login"
                                className={`text-[14px] font-medium transition-colors ${isDarkHeader ? 'text-gray-300 hover:text-white' : 'text-gray-600 hover:text-gray-900'}`}
                            >
                                Log in
                            </Link>
                            <Link
                                href="/signup"
                                className={`px-4 sm:px-5 py-2 sm:py-2.5 rounded-full text-[14px] font-bold text-white transition-all transform active:scale-[0.98] ${isDarkHeader ? 'bg-[#E9C46A] text-black hover:bg-[#d4b059] shadow-lg shadow-[#E9C46A]/20' : 'bg-[#47a479] hover:bg-[#3d8c67] shadow-lg shadow-[#47a479]/20'}`}
                            >
                                Sign up
                            </Link>
                        </div>
                    )}
                </div>
            </header>


        </Fragment>
    );
}
