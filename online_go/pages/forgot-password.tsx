import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';

export default function ForgotPassword() {
    const [identifier, setIdentifier] = useState('');
    const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
    const [message, setMessage] = useState('');
    const router = useRouter();

    useEffect(() => {
        if (router.query.email) {
            setIdentifier(router.query.email as string);
        }
    }, [router.query.email]);

    const handleRecovery = async (e: React.FormEvent) => {
        e.preventDefault();
        setStatus('loading');
        setMessage('');

        // The API_BASE_URL resolution block matching other components
        const API_BASE_URL = typeof window !== 'undefined'
            ? (window.location.hostname === 'localhost' ? 'http://127.0.0.1:8800' : 'http://89.167.122.76:8800')
            : '';

        try {
            const res = await fetch(`${API_BASE_URL}/v1/auth/forgot-password`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ email_or_username: identifier })
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.detail?.msg || data.detail || 'Failed to process recovery request');
            }

            setStatus('success');
            setMessage('If an account exists with that identifier, a secure reset link has been dispatched to your email.');

        } catch (err: any) {
            setStatus('error');
            setMessage(err.message);
        }
    };

    return (
        <div className="min-h-screen bg-[#FDFBF7] text-[#2C2C2C] flex flex-col">
            <Head>
                <title>Recover Account - KAI</title>
            </Head>

            <main className="flex-1 flex items-center justify-center p-6 pt-24">
                <div className="bg-white p-8 rounded-2xl border border-[#EAE5D9] shadow-[0_8px_30px_rgb(0,0,0,0.04)] w-full max-w-md relative overflow-hidden">
                    <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#D9A35F] to-[#C38A4A]" />

                    <div className="text-center mb-8 mt-2">
                        <Link href="/login" className="inline-flex flex-col items-center group mb-4">
                            <span className="font-serif text-xl tracking-[0.3em] font-light text-[#C38A4A] group-hover:text-[#D9A35F] transition-colors">K A I</span>
                        </Link>
                        <h1 className="text-2xl font-black tracking-tight mb-2 text-[#1E1C19]">Account Recovery</h1>
                        <p className="text-sm text-[#948C83]">Enter your associated email or username to regain access.</p>
                    </div>

                    {status === 'success' ? (
                        <div className="flex flex-col items-center animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <div className="w-16 h-16 bg-[#F4F0EC] rounded-full flex items-center justify-center mb-4 border border-[#503C28]/10 shadow-[inset_0_2px_4px_rgba(0,0,0,0.02)]">
                                <svg className="w-8 h-8 text-[#C38A4A]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 19v-8.93a2 2 0 01.89-1.664l7-4.666a2 2 0 012.22 0l7 4.666A2 2 0 0121 10.07V19M3 19a2 2 0 002 2h14a2 2 0 002-2M3 19l6.75-4.5M21 19l-6.75-4.5M3 10l6.75 4.5M21 10l-6.75 4.5m0 0l-1.14.76a2 2 0 01-2.22 0l-1.14-.76" />
                                </svg>
                            </div>
                            <div className="text-center text-sm font-medium text-[#6E675F] leading-relaxed px-4 mb-8">
                                {message}
                            </div>
                            <Link href="/login" className="text-[13px] font-bold text-[#C38A4A] hover:text-[#D9A35F] uppercase tracking-widest transition-colors flex items-center gap-2">
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
                                Return to Sign In
                            </Link>
                        </div>
                    ) : (
                        <form onSubmit={handleRecovery} className="flex flex-col gap-5">
                            {status === 'error' && (
                                <div className="p-3 bg-red-50 border border-red-100/50 text-red-600 rounded-[12px] text-[13px] font-medium text-center shadow-[inset_0_1px_2px_rgba(239,68,68,0.05)]">
                                    {message}
                                </div>
                            )}

                            <div className="flex flex-col gap-2">
                                <label className="text-[13px] font-bold text-[#3A342E] uppercase tracking-wider">Email or Username</label>
                                <input
                                    type="text"
                                    value={identifier}
                                    onChange={(e) => setIdentifier(e.target.value)}
                                    className="px-4 py-3.5 bg-[#FAF8F5] border border-[#EAE5D9] rounded-[14px] focus:outline-none focus:ring-2 focus:ring-[#C38A4A]/20 focus:border-[#C38A4A]/50 transition-all font-medium text-[#1E1C19] shadow-[inset_0_2px_4px_rgba(0,0,0,0.01)]"
                                    placeholder="your@email.com"
                                    required
                                />
                            </div>

                            <button
                                type="submit"
                                disabled={status === 'loading' || !identifier}
                                className="mt-4 w-full bg-gradient-to-b from-[#1a1a1a] to-[#0f0f0f] border border-black/5 hover:from-[#2a2a2a] hover:to-[#1a1a1a] text-[#fce8d5] shadow-[0_12px_30px_rgba(0,0,0,0.25),_inset_0_1px_0_rgba(255,255,255,0.08)] font-bold py-3.5 px-4 rounded-[14px] transition-all disabled:opacity-50 flex justify-center items-center gap-2 group outline-none"
                            >
                                {status === 'loading' ? (
                                    <div className="w-5 h-5 border-2 border-[#fce8d5]/30 border-t-[#fce8d5] rounded-full animate-spin"></div>
                                ) : (
                                    <React.Fragment>
                                        Send Recovery Link
                                        <svg className="w-4 h-4 text-[#fce8d5]/70 group-hover:text-[#fce8d5] group-hover:translate-x-0.5 transition-all" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                                        </svg>
                                    </React.Fragment>
                                )}
                            </button>

                            <div className="text-center mt-2">
                                <Link href="/login" className="text-[12px] font-bold text-[#948C83] hover:text-[#3A342E] uppercase tracking-wider transition-colors inline-block decoration-[#503C28]/20 hover:underline underline-offset-4">
                                    I remember my password
                                </Link>
                            </div>
                        </form>
                    )}
                </div>
            </main>
        </div>
    );
}
