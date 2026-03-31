import React from 'react';
import Head from 'next/head';
import '../styles/globals.css';
import type { AppProps } from 'next/app';
import GlobalHeader from '../components/GlobalHeader';
import { AuthProvider } from '../context/AuthContext';
import { useEffect } from 'react';
import { useRouter } from 'next/router';

export default function App({ Component, pageProps }: AppProps) {
  const router = useRouter();

  useEffect(() => {
    // Check if the current route requires authentication (multiplayer play mode)
    if (router.pathname.startsWith('/play/online') || router.pathname.startsWith('/play/[match_id]')) {
      const token = localStorage.getItem('token');
      if (!token || token === 'undefined' || token === 'null') {
        alert("Please log in to play against other players.");
        router.push('/login');
      }
    }
  }, [router.pathname]);

  return (
    <AuthProvider>
      <div className="min-h-screen flex flex-col font-sans pb-safe">
        <GlobalHeader />
        <main className="flex-1 flex flex-col w-full">
          <Component {...pageProps} />
        </main>
      </div>
    </AuthProvider>
  );
}