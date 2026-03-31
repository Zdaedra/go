import React, { createContext, useContext, useState, useEffect } from 'react';
import { useRouter } from 'next/router';

interface User {
    id: string;
    username: string;
    email: string;
    rating: number;
    rank: string;
    system_points?: number;
    rating_deviation?: number;
    problems_solved?: number;
    analysis_level?: number;
}

interface AuthContextType {
    user: User | null;
    isAuthenticated: boolean;
    isLoading: boolean;
    login: (token: string) => Promise<void>;
    logout: () => void;
    refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
    user: null,
    isAuthenticated: false,
    isLoading: true,
    login: async () => { },
    logout: () => { },
    refreshProfile: async () => { }
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const router = useRouter();

    const fetchProfile = async (token: string) => {
        try {
            // Guard against "undefined" or "null" string values in localStorage
            if (!token || token === 'undefined' || token === 'null') {
                try { localStorage.removeItem('token'); } catch (e) { }
                setUser(null);
                setIsLoading(false);
                return;
            }

            const res = await fetch('http://89.167.122.76:8800/v1/users/me', {
                headers: { 'Authorization': `Bearer ${token}` },
                cache: 'no-store'
            });

            if (res.ok) {
                const data = await res.json();
                setUser(data);
            } else {
                try { localStorage.removeItem('token'); } catch (e) { }
                setUser(null);
            }
        } catch (err) {
            console.error("Failed to fetch user profile:", err);
            try { localStorage.removeItem('token'); } catch (e) { }
            setUser(null);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        // Fallback safety timeout: if stuck loading for 5s, force unlock
        const fallbackTimer = setTimeout(() => {
            setIsLoading(false);
        }, 5000);

        try {
            const token = localStorage.getItem('token');
            if (token) {
                fetchProfile(token);
            } else {
                setIsLoading(false);
            }
        } catch (e) {
            console.error("AuthContext local storage blocked", e);
            setIsLoading(false);
        }

        return () => clearTimeout(fallbackTimer);
    }, []);

    const login = async (token: string) => {
        if (!token) throw new Error("Received empty token from server.");
        try { localStorage.setItem('token', token); } catch (e) { }
        setIsLoading(true);
        await fetchProfile(token);
    };

    const logout = () => {
        localStorage.removeItem('token');
        setUser(null);
        if (router.pathname.startsWith('/profile') || router.pathname === '/play') {
            router.push('/');
        }
    };

    return (
        <AuthContext.Provider value={{
            user,
            isAuthenticated: !!user,
            isLoading,
            login,
            logout,
            refreshProfile: async () => {
                const token = localStorage.getItem('token');
                if (token) await fetchProfile(token);
            }
        }}>
            {children}
        </AuthContext.Provider>
    );
};
