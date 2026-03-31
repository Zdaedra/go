import React, { useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { ChevronLeft } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export default function Login() {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const router = useRouter();
    const { login: authLogin } = useAuth();

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);

        try {
            const params = new URLSearchParams();
            params.append('username', username);
            params.append('password', password);

            const res = await fetch('http://89.167.122.76:8800/v1/auth/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: params.toString()
            });

            const data = await res.json();

            if (!res.ok) {
                let errMsg = 'Failed to login';
                if (data.detail) errMsg = data.detail;
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
                <title>Login - KAI</title>
            </Head>

            <main className="flex-1 flex items-center justify-center p-6 pt-24">
                <div className="bg-white p-8 rounded-2xl border border-[#EAE5D9] shadow-sm w-full max-w-md">
                    <div className="text-center mb-8">
                        <h1 className="text-3xl font-extrabold tracking-tight mb-2">Welcome Back</h1>
                        <p className="text-gray-500">Enter your credentials to access your account</p>
                    </div>

                    {error && (
                        <div className="mb-6 p-4 bg-red-50 border border-red-100 text-red-600 rounded-xl text-sm text-center">
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleLogin} className="flex flex-col gap-5">
                        <div className="flex flex-col gap-2">
                            <label className="text-sm font-medium text-gray-700">Username</label>
                            <input
                                type="text"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                className="px-4 py-3 bg-[#FDFBF7] border border-[#EAE5D9] rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                                placeholder="Enter your username"
                                required
                            />
                        </div>

                        <div className="flex flex-col gap-2">
                            <div className="flex items-center justify-between">
                                <label className="text-sm font-medium text-gray-700">Password</label>
                                <Link href={`/forgot-password${username ? `?email=${encodeURIComponent(username)}` : ''}`} className="text-sm font-semibold text-blue-600 hover:text-blue-800 transition-colors">
                                    Forgot password?
                                </Link>
                            </div>
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="px-4 py-3 bg-[#FDFBF7] border border-[#EAE5D9] rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                                placeholder="Enter your password"
                                required
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={isLoading}
                            className="mt-2 w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-xl transition-colors disabled:opacity-50 flex justify-center items-center"
                        >
                            {isLoading ? (
                                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                            ) : (
                                "Sign In"
                            )}
                        </button>
                    </form>

                    <div className="mt-8 text-center text-sm text-gray-500">
                        Don't have an account?{' '}
                        <Link href="/signup" className="text-blue-600 font-semibold hover:underline">
                            Sign up
                        </Link>
                    </div>
                </div>
            </main>
        </div>
    );
}
