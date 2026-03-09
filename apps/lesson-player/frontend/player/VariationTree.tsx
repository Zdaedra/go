import React from 'react';
import { GitMerge } from 'lucide-react';

interface VariationTreeProps {
    compareStore: any;
    currentKey: string | null;
    onSelect: (key: 'bad' | 'good' | 'neutral') => void;
}

export default function VariationTree({ compareStore, currentKey, onSelect }: VariationTreeProps) {
    if (Object.keys(compareStore).length <= 1) return null;

    return (
        <div className="mt-4 shrink-0 bg-slate-50 p-4 rounded-xl border border-slate-200">
            <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2 mb-3">
                <GitMerge size={16} className="text-blue-500" />
                Дерево Вариаций (Variation Tree)
            </h3>
            
            <div className="flex flex-col gap-2 relative">
                {/* Visual line connecting branches */}
                <div className="absolute left-4 top-2 bottom-2 w-0.5 bg-slate-300 rounded-full"></div>
                
                {compareStore.neutral && (
                    <button 
                        onClick={() => onSelect('neutral')} 
                        className={`relative z-10 flex items-center gap-3 p-2 pr-4 rounded-lg transition-all
                            ${currentKey === 'neutral' ? 'bg-blue-100 border-blue-400 shadow-sm border' : 'hover:bg-slate-200 border border-transparent'}`}
                    >
                        <div className={`w-3 h-3 rounded-full border-2 ${currentKey === 'neutral' ? 'bg-blue-500 border-blue-500' : 'bg-slate-100 border-slate-400 ml-2.5'}`}></div>
                        <span className={`font-medium text-sm ${currentKey === 'neutral' ? 'text-blue-800' : 'text-slate-600'}`}>Реальная партия (Нейтрально)</span>
                    </button>
                )}
                
                {compareStore.good && (
                    <div className="pl-4 relative">
                        {/* Branch line */}
                        <div className="absolute left-0 top-1/2 w-4 h-0.5 bg-slate-300"></div>
                        <button 
                            onClick={() => onSelect('good')} 
                            className={`relative z-10 flex items-center gap-3 p-2 pr-4 rounded-lg transition-all w-full
                                ${currentKey === 'good' ? 'bg-emerald-100 border-emerald-400 shadow-sm border' : 'hover:bg-slate-200 border border-transparent'}`}
                        >
                            <div className={`w-3 h-3 rounded-full border-2 ${currentKey === 'good' ? 'bg-emerald-500 border-emerald-500' : 'bg-slate-100 border-slate-400'}`}></div>
                            <span className={`font-medium text-sm ${currentKey === 'good' ? 'text-emerald-800' : 'text-slate-600'}`}>План А (Лучший вариант)</span>
                        </button>
                    </div>
                )}
                
                {compareStore.bad && (
                    <div className="pl-4 relative">
                        {/* Branch line */}
                        <div className="absolute left-0 top-1/2 w-4 h-0.5 bg-slate-300"></div>
                        <button 
                            onClick={() => onSelect('bad')} 
                            className={`relative z-10 flex items-center gap-3 p-2 pr-4 rounded-lg transition-all w-full
                                ${currentKey === 'bad' ? 'bg-red-100 border-red-400 shadow-sm border' : 'hover:bg-slate-200 border border-transparent'}`}
                        >
                            <div className={`w-3 h-3 rounded-full border-2 ${currentKey === 'bad' ? 'bg-red-500 border-red-500' : 'bg-slate-100 border-slate-400'}`}></div>
                            <span className={`font-medium text-sm ${currentKey === 'bad' ? 'text-red-800' : 'text-slate-600'}`}>Ошибка (Худший вариант)</span>
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
