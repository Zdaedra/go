import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, SkipForward, SkipBack, ArrowLeft } from 'lucide-react';
import { MomentDetail, Step } from '../types/lesson';
import { OverlayState, emptyOverlay, applyOverlayAction, CompareStore, cloneOverlay } from './overlayReducer';
import { BoardState } from '../components/GoBoard';
import VariationTree from './VariationTree';

interface Props {
    moment: MomentDetail;
    boardStatesByMove: BoardState[];
    baseAudioUrl: string;
    onBack: () => void;
    onOverlayChange: (overlay: OverlayState) => void;
    onBoardStateChange: (state: BoardState) => void;
}

export default function MomentPlayerCompare({
    moment, boardStatesByMove, baseAudioUrl, onBack, onOverlayChange, onBoardStateChange
}: Props) {
    const [currentStepIdx, setCurrentStepIdx] = useState(0);
    const [isPlaying, setIsPlaying] = useState(true);

    const [localOverlay, setLocalOverlay] = useState<OverlayState>(emptyOverlay());
    const [compareStore, setCompareStore] = useState<CompareStore>({});

    const audioRef = useRef<HTMLAudioElement | null>(null);

    const buildOverlayForStep = (step: Step) => {
        let newState = emptyOverlay();
        let jumpedToMove = moment.jumpMove;

        step.actions.forEach(act => {
            if (act.type === 'jump') jumpedToMove = act.move;
            newState = applyOverlayAction(newState, act);
        });

        return { overlay: newState, jumpMove: jumpedToMove };
    };

    useEffect(() => {
        if (!moment.steps[currentStepIdx]) return;
        const step = moment.steps[currentStepIdx];

        const { overlay, jumpMove } = buildOverlayForStep(step);

        // Auto-save compare presets 
        if (step.overlayPresetKey) {
            setCompareStore(prev => ({ ...prev, [step.overlayPresetKey!]: cloneOverlay(overlay) }));
        }

        setLocalOverlay(overlay);
        onOverlayChange(overlay);

        const safeMove = Math.min(jumpMove, boardStatesByMove.length - 1);
        onBoardStateChange(boardStatesByMove[safeMove] || {});

        // Manage Audio
        if (audioRef.current) audioRef.current.pause();

        if (step.audio && step.audio.url) {
            const url = step.audio.url.startsWith('http') ? step.audio.url : (baseAudioUrl + step.audio.url);
            const audio = new Audio(url);
            audio.onended = () => {
                if (currentStepIdx < moment.steps.length - 1 && isPlaying) {
                    setCurrentStepIdx(p => p + 1);
                } else {
                    setIsPlaying(false);
                }
            };
            if (isPlaying) audio.play().catch(console.error);
            audioRef.current = audio;
        }

        return () => { if (audioRef.current) audioRef.current.pause(); };
    }, [currentStepIdx, isPlaying, moment, boardStatesByMove]);

    const handleCompareToggle = (key: 'bad' | 'good' | 'neutral') => {
        setIsPlaying(false);
        if (audioRef.current) audioRef.current.pause();

        const stored = compareStore[key];
        if (stored) {
            setLocalOverlay(stored);
            onOverlayChange(stored);
        }
    };

    const togglePlay = () => {
        if (!isPlaying) {
            setIsPlaying(true);
            if (audioRef.current && audioRef.current.paused) audioRef.current.play();
        } else {
            setIsPlaying(false);
            if (audioRef.current) audioRef.current.pause();
        }
    };

    return (
        <div className="flex flex-col h-full bg-white rounded-2xl w-full">
            <button onClick={onBack} className="flex items-center gap-2 text-slate-500 hover:text-blue-600 mb-4 transition font-medium text-sm shrink-0">
                <ArrowLeft size={16} /> Назад к сценариям
            </button>

            <div className="mb-4 border-b pb-4 shrink-0">
                <h2 className="text-xl md:text-2xl font-bold text-slate-800">{moment.title}</h2>
                <span className={`inline-block mt-2 px-3 py-1 rounded-full text-xs font-bold ${moment.type === 'mistake' ? 'bg-red-100 text-red-600' : 'bg-emerald-100 text-emerald-600'}`}>
                    Ход {moment.move_number}
                </span>
            </div>

            {/* Steps List */}
            <div className="space-y-3 flex-1 overflow-y-auto pr-2">
                {moment.steps.map((step, sIdx) => {
                    const isActive = sIdx === currentStepIdx;
                    return (
                        <div
                            key={sIdx}
                            onClick={() => { setCurrentStepIdx(sIdx); setIsPlaying(true); }}
                            className={`p-4 rounded-xl cursor-pointer transition-all duration-300 border-l-[3px]
              ${isActive
                                    ? 'bg-blue-50 border-blue-500 shadow-md transform -translate-y-0.5'
                                    : 'bg-white border-transparent hover:bg-slate-50 border border-slate-100'}`}
                        >
                            <p className={`text-sm md:text-base ${isActive ? 'text-slate-800 font-medium' : 'text-slate-500'}`}>
                                {step.say || "(Аудио: " + step.audio?.url + ")"}
                            </p>
                        </div>
                    );
                })}
            </div>

            {/* Variation Tree Display */}
            <VariationTree
                compareStore={compareStore}
                currentKey={localOverlay.compareKey || null}
                onSelect={handleCompareToggle}
            />

            {/* Player Controls */}
            <div className="flex items-center justify-center gap-6 py-4 mt-2 shrink-0">
                <button disabled={currentStepIdx === 0} onClick={() => { setIsPlaying(false); setCurrentStepIdx(p => Math.max(0, p - 1)); }} className="p-3 bg-white rounded-full shadow hover:bg-slate-100 disabled:opacity-50 text-slate-700 transition">
                    <SkipBack size={20} />
                </button>
                <button onClick={togglePlay} className="p-4 bg-blue-600 text-white rounded-full shadow-lg hover:bg-blue-700 transition transform hover:scale-105 flex items-center justify-center">
                    {isPlaying ? <Pause size={28} /> : <Play size={28} className="ml-1" />}
                </button>
                <button disabled={currentStepIdx === moment.steps.length - 1} onClick={() => { setIsPlaying(false); setCurrentStepIdx(p => Math.min(moment.steps.length - 1, p + 1)); }} className="p-3 bg-white rounded-full shadow hover:bg-slate-100 disabled:opacity-50 text-slate-700 transition">
                    <SkipForward size={20} />
                </button>
            </div>
        </div>
    );
}
