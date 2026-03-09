'use client';

import React, { useState, useEffect } from 'react';
import { AlertCircle, Award } from 'lucide-react';
import GoBoard, { BoardState } from './GoBoard';
import BoardOverlay from './BoardOverlay';
import MomentPlayerCompare from '../player/MomentPlayerCompare';
import { LessonData, MomentDetail } from '../types/lesson';
import { OverlayState, emptyOverlay } from '../player/overlayReducer';

interface LessonPlayerProps {
    storyboard: LessonData;
    gameId: string;
}

export default function LessonPlayer({ storyboard, gameId }: LessonPlayerProps) {
    const [activeMomentId, setActiveMomentId] = useState<string | null>(null);
    const [boardStatesByMove, setBoardStatesByMove] = useState<BoardState[]>([]);

    // Core visual states elevated to Board level
    const [currentBoardState, setCurrentBoardState] = useState<BoardState>({});
    const [currentOverlayState, setCurrentOverlayState] = useState<OverlayState>(emptyOverlay());

    const activeMoment = storyboard.moments?.find(m => m.moment_id === activeMomentId);

    // Fetch and parse SGF on mount to build the board states
    useEffect(() => {
        const fetchSgf = async () => {
            try {
                const Board = (await import('@sabaki/go-board')).default;
                const response = await fetch(storyboard.meta.assets.sgfUrl);
                const sgfText = await response.text();
                const boardSize = parseInt(storyboard.meta.boardSize || 9);

                const states: BoardState[] = [];
                let currentBoard = Board.fromDimensions(boardSize, boardSize);

                const sabakiToCoord = (x: number, y: number, bSize: number) => {
                    const COLS = 'ABCDEFGHJ'.split('');
                    const col = COLS[x];
                    const row = (bSize - y).toString();
                    return `${col}${row}`;
                };

                const currentBoardToDict = (board: any): BoardState => {
                    const state: BoardState = {};
                    const bSize = board.width;
                    for (let y = 0; y < bSize; y++) {
                        for (let x = 0; x < bSize; x++) {
                            const sign = board.get([x, y]);
                            if (sign === 1) state[sabakiToCoord(x, y, bSize)] = 'B';
                            else if (sign === -1) state[sabakiToCoord(x, y, bSize)] = 'W';
                        }
                    }
                    return state;
                };

                states.push(currentBoardToDict(currentBoard));

                const nodes = sgfText.split(';');
                for (const node of nodes) {
                    const match = node.match(/([BW])\[([a-z]{2})\]/i);
                    if (match) {
                        const color = match[1].toUpperCase() === 'B' ? 1 : -1;
                        const posStr = match[2].toLowerCase();
                        const x = posStr.charCodeAt(0) - 97;
                        const y = posStr.charCodeAt(1) - 97;
                        const isValidVertex = x >= 0 && x < boardSize && y >= 0 && y < boardSize;
                        currentBoard = currentBoard.makeMove(color, isValidVertex ? [x, y] : [-1, -1]);
                        states.push(currentBoardToDict(currentBoard));
                    }
                }

                setBoardStatesByMove(states);
            } catch (err) {
                console.error("Failed to fetch or parse SGF:", err);
            }
        };

        if (storyboard?.meta?.assets?.sgfUrl) {
            fetchSgf();
        }
    }, [storyboard]);

    const handleMomentSelect = (moment: MomentDetail) => {
        setActiveMomentId(moment.moment_id);
    };

    const handleBackToCatalog = () => {
        setActiveMomentId(null);
        setCurrentOverlayState(emptyOverlay());
        if (boardStatesByMove.length > 0) {
            setCurrentBoardState(boardStatesByMove[boardStatesByMove.length - 1]);
        }
    };

    if (!storyboard.moments || storyboard.moments.length === 0) return <div className="p-8 text-center text-gray-500">No moments data available.</div>;

    const mistakes = storyboard.moments.filter(m => m.type === 'mistake');
    const strongMoves = storyboard.moments.filter(m => m.type === 'strong');

    const boardSize = parseInt(storyboard.meta.boardSize || 9);

    return (
        <div className="flex flex-col md:flex-row gap-8 max-w-6xl mx-auto p-4">
            {/* Left Panel: Go Board Section with Overlay */}
            <div className="flex-1 max-w-[600px] mx-auto md:mx-0 w-full relative group">
                {/* SVG Board Rendering */}
                <GoBoard
                    size={boardSize}
                    boardState={currentBoardState}
                />

                {/* Visual Canonical Overlay Engine */}
                <BoardOverlay
                    state={currentOverlayState}
                    size={boardSize}
                />
            </div>

            {/* Right Panel: Catalog OR Moment Player */}
            <div className="flex-1 flex flex-col h-[550px] bg-white p-6 rounded-2xl shadow border border-slate-100">

                {/* CATALOG VIEW */}
                {!activeMomentId && (
                    <div className="flex flex-col h-full">
                        <div className="flex justify-between items-center mb-6 border-b pb-4 shrink-0">
                            <h2 className="text-2xl font-bold text-slate-800">Разбор партии</h2>
                            <div className="flex items-center gap-2 bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200">
                                <span className="text-sm font-medium text-slate-600">Вы играли за:</span>
                                <div className="flex items-center gap-1.5">
                                    <div className={`w-4 h-4 rounded-full border border-slate-400 shadow-sm ${storyboard.meta.userColor === 'B' ? 'bg-slate-900' : 'bg-white'}`}></div>
                                    <span className="text-sm font-bold text-slate-800">{storyboard.meta.userColor === 'B' ? 'Черных' : 'Белых'}</span>
                                </div>
                            </div>
                        </div>
                        <div className="space-y-8 flex-1 overflow-y-auto pr-2">

                            {/* Mistakes List */}
                            {mistakes.length > 0 && (
                                <div>
                                    <h3 className="text-lg font-bold text-red-600 mb-4 flex items-center gap-2">
                                        <AlertCircle size={20} />
                                        Ошибки
                                    </h3>
                                    <div className="space-y-3">
                                        {mistakes.map(m => (
                                            <div key={m.moment_id} onClick={() => handleMomentSelect(m)}
                                                className="p-4 border border-red-100 bg-red-50/50 rounded-xl cursor-pointer hover:bg-red-50 hover:shadow transition group">
                                                <div className="flex justify-between items-start mb-2">
                                                    <span className="font-semibold text-slate-800">Ход {m.move_number}</span>
                                                    <span className="text-xs font-bold text-red-500 bg-red-100 px-2 py-1 rounded-md">{m.impact.toFixed(1)} pts</span>
                                                </div>
                                                <h4 className="font-semibold text-slate-700 mb-1">{m.title}</h4>
                                                <p className="text-sm text-slate-500 leading-snug">{m.preview}</p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Strong Moves List */}
                            {strongMoves.length > 0 && (
                                <div>
                                    <h3 className="text-lg font-bold text-emerald-600 mb-4 flex items-center gap-2">
                                        <Award size={20} />
                                        Сильные решения
                                    </h3>
                                    <div className="space-y-3">
                                        {strongMoves.map(m => (
                                            <div key={m.moment_id} onClick={() => handleMomentSelect(m)}
                                                className="p-4 border border-emerald-100 bg-emerald-50/50 rounded-xl cursor-pointer hover:bg-emerald-50 hover:shadow transition group">
                                                <div className="flex justify-between items-start mb-2">
                                                    <span className="font-semibold text-slate-800">Ход {m.move_number}</span>
                                                    <span className="text-xs font-bold text-emerald-600 bg-emerald-100 px-2 py-1 rounded-md">+{m.impact.toFixed(1)} pts</span>
                                                </div>
                                                <h4 className="font-semibold text-slate-700 mb-1">{m.title}</h4>
                                                <p className="text-sm text-slate-500 leading-snug">{m.preview}</p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* MOMENT PLAYER VIEW */}
                {activeMomentId && activeMoment && (
                    <MomentPlayerCompare
                        moment={activeMoment}
                        boardStatesByMove={boardStatesByMove}
                        baseAudioUrl={storyboard.meta.assets.baseAudioUrl || ""}
                        onBack={handleBackToCatalog}
                        onOverlayChange={setCurrentOverlayState}
                        onBoardStateChange={setCurrentBoardState}
                    />
                )}
            </div>
        </div>
    );
}
