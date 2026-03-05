'use client';

import React from 'react';

// Coordinates A-J (skip I), 1-9
const COLS = 'ABCDEFGHJ'.split('');
const ROWS = '123456789'.split('').reverse(); // 9 at top, 1 at bottom

export type BoardState = { [coord: string]: 'B' | 'W' };
export type PVNode = { coord: string; num: number };
export type MarkNode = { coord: string; label: string };
export type VariationNode = { coord: string; color: 'B' | 'W'; num: number };

interface GoBoardProps {
  size?: number;
  boardState: BoardState; // { 'C4': 'B', 'D4': 'W' }
  highlightMove?: string; // 'E5'
  pvList?: PVNode[];      // [ {coord: 'C4', num: 1} ...]
  marks?: MarkNode[];     // [ {coord: 'D4', label: 'X'} ]
  variationSequence?: VariationNode[]; // Ghost stones for engine variations
}

export default function GoBoard({
  size = 9,
  boardState = {},
  highlightMove,
  pvList = [],
  marks = [],
  variationSequence = []
}: GoBoardProps) {

  // Map coord string (e.g. C4) to x,y in 0-8 range
  const parseCoord = (coord: string) => {
    if (!coord || coord.length < 2) return null;
    const colStr = coord[0].toUpperCase();
    const rowStr = coord.substring(1);
    const x = COLS.indexOf(colStr);
    const y = ROWS.indexOf(rowStr);
    return { x, y };
  };

  const lines = Array.from({ length: size }, (_, i) => i);

  // Calculate SVG dimensions with 1 unit padding for coordinates
  const svgSize = size + 1; // e.g. 10x10 for a 9x9 board with margins
  const offset = 1; // start grid at x=1, y=1

  return (
    <div className="w-full aspect-square bg-[#ecc159] p-2 sm:p-4 rounded shadow-lg flex items-center justify-center">
      <svg
        viewBox={`0 0 ${svgSize} ${svgSize}`}
        className="w-full h-full drop-shadow-md"
        style={{ maxWidth: '600px', maxHeight: '600px' }}
      >
        {/* Board Background */}
        <rect x="0" y="0" width={svgSize} height={svgSize} fill="#ecc159" />

        {/* Grid Lines */}
        {Array.from({ length: size }).map((_, i) => (
          <React.Fragment key={i}>
            {/* Horizontal */}
            <line x1={offset} y1={i + offset} x2={size - 1 + offset} y2={i + offset} stroke="black" strokeWidth="0.03" />
            {/* Vertical */}
            <line x1={i + offset} y1={offset} x2={i + offset} y2={size - 1 + offset} stroke="black" strokeWidth="0.03" />
          </React.Fragment>
        ))}

        {/* Star Points (Hoshi) for 9x9 */}
        {size === 9 && (
          <>
            <circle cx={2 + offset} cy={2 + offset} r="0.1" fill="black" />
            <circle cx={6 + offset} cy={2 + offset} r="0.1" fill="black" />
            <circle cx={4 + offset} cy={4 + offset} r="0.1" fill="black" />
            <circle cx={2 + offset} cy={6 + offset} r="0.1" fill="black" />
            <circle cx={6 + offset} cy={6 + offset} r="0.1" fill="black" />
          </>
        )}

        {/* Coordinates Labels */}
        {Array.from({ length: size }).map((_, i) => {
          const letter = 'ABCDEFGHJ'[i];
          const number = (size - i).toString();
          return (
            <React.Fragment key={`coord-${i}`}>
              {/* Top Letters */}
              <text x={i + offset} y={0.3} fontSize="0.4" textAnchor="middle" fill="#66501a" fontWeight="bold">{letter}</text>
              {/* Bottom Letters */}
              <text x={i + offset} y={size + 0.6} fontSize="0.4" textAnchor="middle" fill="#66501a" fontWeight="bold">{letter}</text>

              {/* Left Numbers */}
              <text x={0.3} y={i + offset} fontSize="0.4" textAnchor="middle" dominantBaseline="central" fill="#66501a" fontWeight="bold">{number}</text>
              {/* Right Numbers */}
              <text x={size + 0.6} y={i + offset} fontSize="0.4" textAnchor="middle" dominantBaseline="central" fill="#66501a" fontWeight="bold">{number}</text>
            </React.Fragment>
          );
        })}

        {/* Stones from Board State */}
        {Object.entries(boardState).map(([coord, color]) => {
          const pos = parseCoord(coord);
          if (!pos || pos.x < 0 || pos.y < 0) return null;
          return (
            <circle
              key={coord}
              cx={pos.x + offset}
              cy={pos.y + offset}
              r={0.48}
              fill={color === 'B' ? '#111' : '#f8f8f8'}
              stroke="#000"
              strokeWidth={0.02}
              className="drop-shadow-sm transition-all duration-300"
            />
          );
        })}

        {/* Recent Move Highlight */}
        {highlightMove && (() => {
          const pos = parseCoord(highlightMove);
          if (!pos || pos.x < 0 || pos.y < 0) return null;
          return (
            <circle
              cx={pos.x + offset}
              cy={pos.y + offset}
              r={0.25}
              fill="none"
              stroke="#3b82f6"
              strokeWidth={0.1}
              className="animate-pulse"
            />
          );
        })()}

        {/* PV List (Sequence Numbers) */}
        {pvList.map((node) => {
          const pos = parseCoord(node.coord);
          if (!pos || pos.x < 0 || pos.y < 0) return null;
          return (
            <g key={`pv-${node.coord}`}>
              <circle
                cx={pos.x + offset}
                cy={pos.y + offset}
                r={0.4}
                fill="rgba(59, 130, 246, 0.8)"
                stroke="#fff"
                strokeWidth={0.03}
              />
              <text x={pos.x + offset} y={pos.y + offset} fontSize="0.4" textAnchor="middle" dominantBaseline="central" fill="white" fontWeight="bold">
                {node.num}
              </text>
            </g>
          );
        })}

        {/* Marks */}
        {marks.map((m) => {
          const pos = parseCoord(m.coord);
          if (!pos || pos.x < 0 || pos.y < 0) return null;
          // red cross or letter
          return (
            <text key={`mark-${m.coord}`} x={pos.x + offset} y={pos.y + offset} fontSize="0.5" textAnchor="middle" dominantBaseline="central" fill="#ef4444" fontWeight="bold">
              {m.label}
            </text>
          );
        })}

        {/* Variation Sequence (Ghost Stones) */}
        {variationSequence.map((v) => {
          const pos = parseCoord(v.coord);
          if (!pos || pos.x < 0 || pos.y < 0) return null;
          // semi-transparent stones based on color
          const fillColor = v.color === 'B' ? 'rgba(17, 17, 17, 0.7)' : 'rgba(248, 248, 248, 0.8)';
          const textColor = v.color === 'B' ? 'white' : 'black';
          return (
            <g key={`var-${v.coord}-${v.num}`}>
              <circle
                cx={pos.x + offset}
                cy={pos.y + offset}
                r={0.44}
                fill={fillColor}
                stroke="#000"
                strokeWidth={0.02}
              />
              <text x={pos.x + offset} y={pos.y + offset} fontSize="0.4" textAnchor="middle" dominantBaseline="central" fill={textColor} fontWeight="bold">
                {v.num}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
