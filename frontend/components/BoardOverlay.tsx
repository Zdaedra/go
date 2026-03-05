import React from 'react';
import { OverlayState } from '../player/overlayReducer';
import { parseCoord } from '../utils/coords';

interface Props {
    state: OverlayState;
    size?: number;
}

export default function BoardOverlay({ state, size = 9 }: Props) {
    const svgSize = size + 1;
    const offset = 1;

    // Helpers to get pixel-exact coords for SVG logic
    const getPt = (coord: string) => parseCoord(coord);

    return (
        <svg viewBox={`0 0 ${svgSize} ${svgSize}`} className="absolute inset-0 w-full h-full pointer-events-none z-10">
            {/* Spotlight Mask Definition */}
            {state.spotlight && (
                <defs>
                    <mask id="spotlight-mask">
                        {/* White is visible (dimmed), Black is invisible (clear focus area) */}
                        <rect x="0" y="0" width={svgSize} height={svgSize} fill="white" />
                        {state.spotlight.kind === "bbox" && (() => {
                            const p1 = getPt(state.spotlight.from);
                            const p2 = getPt(state.spotlight.to);
                            if (!p1 || !p2) return null;
                            const minX = Math.min(p1.x, p2.x) + offset - 0.7;
                            const maxX = Math.max(p1.x, p2.x) + offset + 0.7;
                            const minY = Math.min(p1.y, p2.y) + offset - 0.7;
                            const maxY = Math.max(p1.y, p2.y) + offset + 0.7;
                            return <rect x={minX} y={minY} width={maxX - minX} height={maxY - minY} fill="black" rx="0.2" />;
                        })()}
                        {state.spotlight.kind === "points" && state.spotlight.points.map(pt => {
                            const p = getPt(pt);
                            if (!p) return null;
                            return <circle key={pt} cx={p.x + offset} cy={p.y + offset} r={0.8} fill="black" />;
                        })}
                        {state.spotlight.kind === "polygon" && (() => {
                            const pts = state.spotlight.points.map(pt => {
                                const p = getPt(pt);
                                if (!p) return "";
                                return `${p.x + offset},${p.y + offset}`;
                            }).join(" ");
                            return <polygon points={pts} fill="black" />;
                        })()}
                    </mask>
                </defs>
            )}

            {/* Dimmed Background Overlay */}
            {state.spotlight && (
                <rect
                    x="0" y="0"
                    width={svgSize} height={svgSize}
                    fill="black"
                    opacity={state.spotlight.dimOpacity}
                    mask="url(#spotlight-mask)"
                    className="transition-opacity duration-500"
                />
            )}

            {/* Regions */}
            {state.regions.map((r, i) => {
                if (r.points.length === 2) {
                    const p1 = getPt(r.points[0]);
                    const p2 = getPt(r.points[1]);
                    if (!p1 || !p2) return null;
                    const minX = Math.min(p1.x, p2.x) + offset - 0.5;
                    const maxX = Math.max(p1.x, p2.x) + offset + 0.5;
                    const minY = Math.min(p1.y, p2.y) + offset - 0.5;
                    const maxY = Math.max(p1.y, p2.y) + offset + 0.5;
                    return (
                        <g key={`region-${i}`}>
                            <rect x={minX} y={minY} width={maxX - minX} height={maxY - minY} fill="rgba(59, 130, 246, 0.2)" stroke="#3b82f6" strokeWidth="0.05" strokeDasharray="0.1 0.1" rx="0.2" />
                            {r.label && <text x={minX + (maxX - minX) / 2} y={minY - 0.2} fontSize="0.3" fill="#3b82f6" fontWeight="bold" textAnchor="middle">{r.label}</text>}
                        </g>
                    );
                }
                return null;
            })}

            {/* Arrows */}
            {state.arrows.map((arr, i) => {
                const p1 = getPt(arr.from);
                const p2 = getPt(arr.to);
                if (!p1 || !p2) return null;
                return (
                    <g key={`arrow-${i}`}>
                        <defs>
                            <marker id={`arrowhead-${i}`} markerWidth="3" markerHeight="3" refX="2.5" refY="1.5" orient="auto">
                                <polygon points="0 0, 3 1.5, 0 3" fill="#ef4444" />
                            </marker>
                        </defs>
                        <line x1={p1.x + offset} y1={p1.y + offset} x2={p2.x + offset} y2={p2.y + offset} stroke="#ef4444" strokeWidth="0.08" markerEnd={`url(#arrowhead-${i})`} />
                        {arr.label && (
                            <text x={(p1.x + p2.x) / 2 + offset} y={(p1.y + p2.y) / 2 + offset - 0.2} fontSize="0.3" fill="#ef4444" textAnchor="middle" fontWeight="bold" className="drop-shadow-md">
                                {arr.label}
                            </text>
                        )}
                    </g>
                );
            })}

            {/* Marks & Highlights */}
            {state.highlights.map((h, i) => {
                const p = getPt(h);
                if (!p) return null;
                return <circle key={`hl-${i}`} cx={p.x + offset} cy={p.y + offset} r={0.45} fill="none" stroke="#2563eb" strokeWidth={0.06} strokeDasharray="0.1 0.1" className="animate-pulse" />;
            })}
            {state.marks.map((m, i) => {
                const p = getPt(m.at);
                if (!p) return null;
                const color = m.shape === 'x' ? '#ef4444' : (m.shape === 'circle' ? '#10b981' : '#f59e0b');
                return (
                    <text key={`mark-${i}`} x={p.x + offset} y={p.y + offset + 0.03} fontSize="0.6" textAnchor="middle" dominantBaseline="central" fill={color} fontWeight="bold" className="drop-shadow-md">
                        {m.shape === 'x' ? '✗' : (m.shape === 'circle' ? 'О' : '△')}
                    </text>
                );
            })}

            {/* Ghost stones */}
            {state.ghostStones.map((g, i) => {
                const p = getPt(g.at);
                if (!p) return null;
                const fillColor = g.color === 'B' ? 'rgba(17, 17, 17, 0.7)' : 'rgba(248, 248, 248, 0.8)';
                const textColor = g.color === 'B' ? 'white' : 'black';
                return (
                    <g key={`ghost-${i}`}>
                        <circle cx={p.x + offset} cy={p.y + offset} r={0.44} fill={fillColor} stroke="#000" strokeWidth={0.02} />
                        <text x={p.x + offset} y={p.y + offset + 0.02} fontSize="0.4" textAnchor="middle" dominantBaseline="central" fill={textColor} fontWeight="bold">{g.num}</text>
                    </g>
                );
            })}

            {/* Text Labels (Render last to be on top) */}
            {state.labels.map((l, i) => {
                const p = getPt(l.at);
                if (!p) return null;
                // Soft banner / tag style
                return (
                    <g key={`lbl-${i}`} transform={`translate(${p.x + offset}, ${p.y + offset - 0.6})`}>
                        <rect x="-1" y="-0.35" width="2" height="0.5" fill="rgba(255,255,255,0.95)" rx="0.1" stroke="#cbd5e1" strokeWidth="0.02" />
                        <text x="0" y="-0.03" fontSize="0.25" textAnchor="middle" dominantBaseline="middle" fill="#1e293b" fontWeight="bold">{l.text}</text>
                    </g>
                );
            })}

        </svg>
    );
}
