import React, { useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { ChevronLeft } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export default function Signup() {
    const [username, setUsername] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const router = useRouter();
    const { login: authLogin } = useAuth();

    const handleSignup = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (password !== confirmPassword) {
            setError("Passwords do not match");
            return;
        }

        if (password.length < 6) {
            setError("Password must be at least 6 characters long");
            return;
        }

        setIsLoading(true);

        try {
            const res = await fetch('http://89.167.122.76:8800/v1/auth/register', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ username, email, password })
            });

            const data = await res.json();

            if (!res.ok) {
                let errMsg = 'Failed to register';
                if (data.detail) {
                    if (typeof data.detail === 'string') {
                        errMsg = data.detail;
                    } else if (Array.isArray(data.detail) && data.detail.length > 0 && data.detail[0].msg) {
                        errMsg = data.detail[0].msg;
                    } else {
                        errMsg = JSON.stringify(data.detail);
                    }
                }
                throw new Error(errMsg);
            }

            await authLogin(data.access_token);
            router.push('/profile');

        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#FDFBF7] text-[#2C2C2C] flex flex-col">
            <Head>
                <title>Create Account - KAI</title>
            </Head>

            <main className="flex-1 flex items-center justify-center p-6 pt-24">
                <div className="bg-white p-8 rounded-2xl border border-[#EAE5D9] shadow-sm w-full max-w-md">
                    <div className="text-center mb-8">
                        <h1 className="text-3xl font-extrabold tracking-tight mb-2">Create Account</h1>
                        <p className="text-gray-500">Join KAI and track your progress</p>
                    </div>

                    {error && (
                        <div className="mb-6 p-4 bg-red-50 border border-red-100 text-red-600 rounded-xl text-sm text-center flex flex-col gap-2 relative">
                            <span>{error}</span>
                            {error.toLowerCase().includes('registered') || error.toLowerCase().includes('exists') ? (
                                <Link href={`/forgot-password${email ? `?email=${encodeURIComponent(email)}` : ''}`} className="inline-block mt-1 font-bold text-red-700 hover:text-red-800 underline decoration-red-300 underline-offset-2 transition-colors">
                                    Need to recover your password?
                                </Link>
                            ) : null}
                        </div>
                    )}

                    <form onSubmit={handleSignup} className="flex flex-col gap-5">
                        <div className="flex flex-col gap-2">
                            <label className="text-sm font-medium text-gray-700">Username</label>
                            <input
                                type="text"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                className="px-4 py-3 bg-[#FDFBF7] border border-[#EAE5D9] rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                                placeholder="Choose a username"
                                required
                            />
                        </div>

                        <div className="flex flex-col gap-2">
                            <label className="text-sm font-medium text-gray-700">Email</label>
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="px-4 py-3 bg-[#FDFBF7] border border-[#EAE5D9] rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                                placeholder="Enter your email"
                                required
                            />
                        </div>

                        <div className="flex flex-col gap-2">
                            <label className="text-sm font-medium text-gray-700">Password</label>
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="px-4 py-3 bg-[#FDFBF7] border border-[#EAE5D9] rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                                placeholder="Create a password"
                                required
                            />
                        </div>

                        <div className="flex flex-col gap-2">
                            <label className="text-sm font-medium text-gray-700">Confirm Password</label>
                            <input
                                type="password"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                className="px-4 py-3 bg-[#FDFBF7] border border-[#EAE5D9] rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                                placeholder="Confirm your password"
                                required
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={isLoading}
                            className="mt-2 w-full bg-black hover:bg-gray-800 text-white font-bold py-3 px-4 rounded-xl transition-colors disabled:opacity-50 flex justify-center items-center"
                        >
                            {isLoading ? (
                                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                            ) : (
                                "Sign Up"
                            )}
                        </button>
                    </form>

                    <div className="mt-8 text-center text-sm text-gray-500">
                        Already have an account?{' '}
                        <Link href="/login" className="text-blue-600 font-semibold hover:underline">
                            Sign in
                        </Link>
                    </div>
                </div>
            </main>
        </div>
    );
}
