import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';

export default function ResetPassword() {
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [token, setToken] = useState('');
    const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
    const [message, setMessage] = useState('');
    const router = useRouter();

    useEffect(() => {
        if (router.query.token) {
            setToken(router.query.token as string);
        }
    }, [router.query.token]);

    const handleReset = async (e: React.FormEvent) => {
        e.preventDefault();
        setStatus('loading');
        setMessage('');

        if (password !== confirmPassword) {
            setStatus('error');
            setMessage('Passwords do not match.');
            return;
        }

        if (password.length < 6) {
            setStatus('error');
            setMessage('Password must be at least 6 characters long.');
            return;
        }

        const API_BASE_URL = typeof window !== 'undefined'
            ? (window.location.hostname === 'localhost' ? 'http://127.0.0.1:8800' : 'http://89.167.122.76:8800')
            : '';

        try {
            const res = await fetch(`${API_BASE_URL}/v1/auth/reset-password`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ token, new_password: password })
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.detail?.msg || data.detail || 'Failed to reset password');
            }

            setStatus('success');
            setMessage('Your password has been successfully reset. You may now sign in.');

        } catch (err: any) {
            setStatus('error');
            setMessage(err.message);
        }
    };

    return (
        <div className="min-h-screen bg-[#FDFBF7] text-[#2C2C2C] flex flex-col">
            <Head>
                <title>New Password - KAI</title>
            </Head>

            <main className="flex-1 flex items-center justify-center p-6 pt-24">
                <div className="bg-white p-8 rounded-2xl border border-[#EAE5D9] shadow-[0_8px_30px_rgb(0,0,0,0.04)] w-full max-w-md relative overflow-hidden">
                    <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#D9A35F] to-[#C38A4A]" />

                    <div className="text-center mb-8 mt-2">
                        <Link href="/login" className="inline-flex flex-col items-center group mb-4">
                            <span className="font-serif text-xl tracking-[0.3em] font-light text-[#C38A4A] group-hover:text-[#D9A35F] transition-colors">K A I</span>
                        </Link>
                        <h1 className="text-2xl font-black tracking-tight mb-2 text-[#1E1C19]">New Password</h1>
                        <p className="text-sm text-[#948C83]">Create a strong password for your account.</p>
                    </div>

                    {status === 'success' ? (
                        <div className="flex flex-col items-center animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <div className="w-16 h-16 bg-[#E5F1EB] rounded-full flex items-center justify-center mb-4 border border-[#4CAF84]/20 shadow-[inset_0_2px_4px_rgba(0,0,0,0.02)]">
                                <svg className="w-8 h-8 text-[#4CAF84]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                                </svg>
                            </div>
                            <div className="text-center text-sm font-medium text-[#6E675F] leading-relaxed px-4 mb-8">
                                {message}
                            </div>
                            <Link href="/login" className="w-full bg-gradient-to-b from-[#1a1a1a] to-[#0f0f0f] border border-black/5 hover:from-[#2a2a2a] hover:to-[#1a1a1a] text-[#fce8d5] shadow-[0_12px_30px_rgba(0,0,0,0.25),_inset_0_1px_0_rgba(255,255,255,0.08)] font-bold py-3.5 px-4 rounded-[14px] transition-all flex justify-center items-center gap-2 outline-none">
                                Sign In Now
                            </Link>
                        </div>
                    ) : (
                        <form onSubmit={handleReset} className="flex flex-col gap-5">
                            {status === 'error' && (
                                <div className="p-3 bg-red-50 border border-red-100/50 text-red-600 rounded-[12px] text-[13px] font-medium text-center shadow-[inset_0_1px_2px_rgba(239,68,68,0.05)]">
                                    {message}
                                </div>
                            )}

                            <div className="flex flex-col gap-2">
                                <label className="text-[13px] font-bold text-[#3A342E] uppercase tracking-wider">New Password</label>
                                <input
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="px-4 py-3.5 bg-[#FAF8F5] border border-[#EAE5D9] rounded-[14px] focus:outline-none focus:ring-2 focus:ring-[#C38A4A]/20 focus:border-[#C38A4A]/50 transition-all font-medium text-[#1E1C19] shadow-[inset_0_2px_4px_rgba(0,0,0,0.01)]"
                                    placeholder="••••••••"
                                    required
                                />
                            </div>

                            <div className="flex flex-col gap-2">
                                <label className="text-[13px] font-bold text-[#3A342E] uppercase tracking-wider">Confirm Password</label>
                                <input
                                    type="password"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    className="px-4 py-3.5 bg-[#FAF8F5] border border-[#EAE5D9] rounded-[14px] focus:outline-none focus:ring-2 focus:ring-[#C38A4A]/20 focus:border-[#C38A4A]/50 transition-all font-medium text-[#1E1C19] shadow-[inset_0_2px_4px_rgba(0,0,0,0.01)]"
                                    placeholder="••••••••"
                                    required
                                />
                            </div>

                            <button
                                type="submit"
                                disabled={status === 'loading' || !password || !confirmPassword || !token}
                                className="mt-4 w-full bg-gradient-to-b from-[#1a1a1a] to-[#0f0f0f] border border-black/5 hover:from-[#2a2a2a] hover:to-[#1a1a1a] text-[#fce8d5] shadow-[0_12px_30px_rgba(0,0,0,0.25),_inset_0_1px_0_rgba(255,255,255,0.08)] font-bold py-3.5 px-4 rounded-[14px] transition-all disabled:opacity-50 flex justify-center items-center gap-2 group outline-none"
                            >
                                {status === 'loading' ? (
                                    <div className="w-5 h-5 border-2 border-[#fce8d5]/30 border-t-[#fce8d5] rounded-full animate-spin"></div>
                                ) : (
                                    "Save Password"
                                )}
                            </button>
                        </form>
                    )}
                </div>
            </main>
        </div>
    );
}
