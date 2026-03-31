import React from 'react';
import {
    LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import { format, parseISO } from 'date-fns';

export default function RatingChart({ data }) {
    if (!data || data.length === 0) {
        return <div className="flex items-center justify-center p-8 bg-gray-50 rounded-xl text-gray-500 border border-gray-100">No rating history available yet. Play a game or solve puzzles!</div>;
    }

    const chartData = data.map(d => ({
        ...d,
        date: format(parseISO(d.created_at), 'MMM dd, HH:mm')
    }));

    // Ensure we have at least domains
    const minRating = Math.min(...chartData.map(d => d.new_rating)) - 50;
    const maxRating = Math.max(...chartData.map(d => d.new_rating)) + 50;

    return (
        <div className="w-full h-64 bg-white p-4 rounded-2xl shadow-sm border border-[#EAE5D9]">
            <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 5, right: 20, left: -20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="date" stroke="#888" fontSize={12} tickLine={false} />
                    <YAxis dataKey="new_rating" stroke="#888" fontSize={12} tickLine={false} domain={[minRating, maxRating]} />
                    <Tooltip
                        contentStyle={{ borderRadius: '12px', border: '1px solid #EAE5D9', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}
                        formatter={(value, name, props) => {
                            const change = props.payload.points_change;
                            const sign = change > 0 ? '+' : '';
                            return [
                                `${value} (${sign}${change} from ${props.payload.match_type})`,
                                'Rating'
                            ];
                        }}
                    />
                    <Line type="monotone" dataKey="new_rating" stroke="#2C2C2C" strokeWidth={3} dot={{ r: 4, strokeWidth: 2, fill: '#fff' }} activeDot={{ r: 6 }} />
                </LineChart>
            </ResponsiveContainer>
        </div>
    );
}
