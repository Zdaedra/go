import React from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import Svg, {
  Rect, Line, Circle, Text as SvgText, Polygon, Defs, RadialGradient,
  LinearGradient, Stop, G, Ellipse,
} from 'react-native-svg';
import { GTP_COLS } from '../engine/board';
import { useTheme } from '../theme/ThemeContext';

const CELL = 24;
const PAD = 26;

export interface GobanMark {
  at: number;
  label?: string | null;   // letter to draw (A, B, C…)
  kind?: string;           // 'letter' | 'triangle' | 'square'
}

export interface GhostStone {
  at: number;
  color: 'b' | 'w';
  label?: string | null;
}

export interface ViewRect {
  c0: number; r0: number; c1: number; r1: number;
}

interface GobanProps {
  /** size*size-char position string ('.', 'b', 'w'). */
  position: string;
  /** Board size; defaults to 9. */
  size?: number;
  /** Visible sub-rectangle (for large-board corner problems). */
  view?: ViewRect;
  /** Move numbers by board index (optional). */
  numbers?: Map<number, number>;
  lastMove?: number | null;
  marks?: GobanMark[];
  ghosts?: GhostStone[];
  /** H1-подсказка: мягкая подсветка зоны «на что смотреть» (ТЗ v3.2 §5). */
  zone?: ViewRect | null;
  onPoint?: (at: number) => void;
  disabled?: boolean;
}

function hoshiPoints(size: number): [number, number][] {
  if (size === 9) return [[2, 2], [6, 2], [4, 4], [2, 6], [6, 6]];
  if (size === 13) return [[3, 3], [9, 3], [6, 6], [3, 9], [9, 9]];
  if (size === 19) {
    const pts: [number, number][] = [];
    for (const c of [3, 9, 15]) for (const r of [3, 9, 15]) pts.push([c, r]);
    return pts;
  }
  return [];
}

export default function Goban({
  position, size = 9, view, numbers, lastMove, marks = [], ghosts = [],
  zone, onPoint, disabled,
}: GobanProps) {
  const { board, stones } = useTheme();
  const layoutSize = React.useRef(1);
  // Gradient ids must be unique per instance: on web all mounted SVGs share
  // one document, and a duplicate id can resolve into a hidden (display:none)
  // stack screen whose defs don't render.
  const uid = React.useId().replace(/[^a-zA-Z0-9]/g, '');
  const gid = {
    wood: `wood-${uid}`,
    sheen: `sheen-${uid}`,
    b: `stone-b-${uid}`,
    w: `stone-w-${uid}`,
  };

  const v: ViewRect = view ?? { c0: 0, r0: 0, c1: size - 1, r1: size - 1 };
  const px = (i: number) => PAD + i * CELL;
  const colOf = (i: number) => i % size;
  const rowOf = (i: number) => Math.floor(i / size);

  // Coordinates live OUTSIDE the wood slab on the page ground (reference
  // design); cropped boards label only the visible range. The gutter is
  // tight so the wood reaches the mockup's 64-device-px side margins.
  const GUTTER = 11;
  const woodX = px(v.c0) - PAD;
  const woodY = px(v.r0) - PAD;
  const woodW = px(v.c1) - px(v.c0) + PAD * 2;
  const woodH = px(v.r1) - px(v.r0) + PAD * 2;
  const minX = woodX - GUTTER;
  const minY = woodY - GUTTER;
  const viewW = woodW + GUTTER * 2;
  const viewH = woodH + GUTTER * 2;

  const inView = (i: number) => {
    const c = colOf(i), r = rowOf(i);
    return c >= v.c0 - 0 && c <= v.c1 && r >= v.r0 && r <= v.r1;
  };

  const handlePress = (evt: { nativeEvent: { locationX: number; locationY: number } }) => {
    if (!onPoint || disabled) return;
    const { locationX, locationY } = evt.nativeEvent;
    const scale = viewW / layoutSize.current;
    const c = Math.round((locationX * scale + minX - PAD) / CELL);
    const r = Math.round((locationY * scale * 1 + minY - PAD) / CELL);
    if (c < v.c0 || r < v.r0 || c > v.c1 || r > v.r1) return;
    onPoint(r * size + c);
  };

  const cols = Array.from({ length: v.c1 - v.c0 + 1 }, (_, k) => v.c0 + k);
  const rows = Array.from({ length: v.r1 - v.r0 + 1 }, (_, k) => v.r0 + k);
  // Grid lines stop at the true board edge; on cropped views they run all
  // the way to the wood edge so the board reads as continuing beyond.
  const lineX0 = px(v.c0) - (v.c0 > 0 ? PAD : 0);
  const lineX1 = px(v.c1) + (v.c1 < size - 1 ? PAD : 0);
  const lineY0 = px(v.r0) - (v.r0 > 0 ? PAD : 0);
  const lineY1 = px(v.r1) + (v.r1 < size - 1 ? PAD : 0);

  const stoneR = 9.6; // 0.80 × cell, per mockup measurement

  // Deterministic wood texture: fine jittered grain lines (same LCG as the
  // reference renderer) plus irregular wide planks — varied widths and
  // opacities so the striations read organic, not metronomic.
  const { grainLines, planks } = React.useMemo(() => {
    const lines: { x: number; x2: number }[] = [];
    let gx = woodX + 4;
    let seed = 7;
    while (gx < woodX + woodW - 4) {
      seed = (seed * 16807) % 2147483647;
      lines.push({ x: gx, x2: gx + (seed % 3) - 1 });
      gx += 6 + (seed % 9);
    }
    const bands: { x: number; w: number; o: number }[] = [];
    let bx = woodX + 2;
    let s2 = 42;
    while (bx < woodX + woodW - 8) {
      s2 = (s2 * 16807) % 2147483647;
      const w = 6 + (s2 % 33);
      s2 = (s2 * 16807) % 2147483647;
      bands.push({ x: bx, w, o: 0.03 + (s2 % 8) * 0.009 });
      s2 = (s2 * 16807) % 2147483647;
      bx += w + 10 + (s2 % 26);
    }
    return { grainLines: lines, planks: bands };
  }, [woodX, woodW]);

  const renderStone = (at: number, color: 'b' | 'w', numText?: string, hot?: boolean) => {
    const s = color === 'b' ? stones.black : stones.white;
    const cx = px(colOf(at));
    const cy = px(rowOf(at));
    return (
      <G key={`s${at}`}>
        {stones.shadowOpacity > 0 && (
          <Ellipse
            cx={cx + 1.2} cy={cy + 2.4} rx={stoneR + 0.6} ry={stoneR - 0.2}
            fill={stones.shadow} opacity={stones.shadowOpacity}
          />
        )}
        <Circle
          cx={cx} cy={cy} r={stoneR}
          fill={`url(#${color === 'b' ? gid.b : gid.w})`}
          stroke={s.stroke === 'none' ? undefined : s.stroke}
          strokeWidth={s.strokeWidth}
        />
        {s.highlightOpacity > 0 && (
          <Ellipse
            cx={cx - 2.2} cy={cy - 3.4} rx={5.4} ry={1.7}
            rotation={-30} originX={cx - 2.2} originY={cy - 3.4}
            fill={s.highlight} opacity={s.highlightOpacity * 0.62}
          />
        )}
        {numText != null && (
          <SvgText
            x={cx} y={cy + 3.8} textAnchor="middle"
            fontSize={numText.length > 2 ? 8.5 : 10.5}
            fontWeight={hot ? '800' : '600'}
            fill={hot ? board.letter : s.text} fontFamily="InterV"
          >
            {numText}
          </SvgText>
        )}
      </G>
    );
  };

  return (
    <View style={styles.wrap}>
      <Pressable
        onPress={handlePress}
        onLayout={(e) => { layoutSize.current = e.nativeEvent.layout.width; }}
        style={[styles.square, { aspectRatio: viewW / viewH }]}
      >
        <Svg viewBox={`${minX} ${minY} ${viewW} ${viewH}`} width="100%" height="100%">
          <Defs>
            <LinearGradient id={gid.wood} x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={board.wood[0]} />
              <Stop offset="0.45" stopColor={board.wood[1]} />
              <Stop offset="1" stopColor={board.wood[2]} />
            </LinearGradient>
            <RadialGradient id={gid.b} cx="0.35" cy="0.3" r="0.9">
              <Stop offset="0" stopColor={stones.black.fill[0]} />
              <Stop offset="0.45" stopColor={stones.black.fill[1]} />
              <Stop offset="1" stopColor={stones.black.fill[2]} />
            </RadialGradient>
            <RadialGradient id={gid.w} cx="0.35" cy="0.3" r="0.9">
              <Stop offset="0" stopColor={stones.white.fill[0]} />
              <Stop offset="0.5" stopColor={stones.white.fill[1]} />
              <Stop offset="1" stopColor={stones.white.fill[2]} />
            </RadialGradient>
            <LinearGradient id={gid.sheen} x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor="#FFECCD" stopOpacity={0.05} />
              <Stop offset="0.5" stopColor="#FFECCD" stopOpacity={0} />
              <Stop offset="1" stopColor="#000000" stopOpacity={0.06} />
            </LinearGradient>
          </Defs>

          <Rect x={woodX} y={woodY} width={woodW} height={woodH} rx={10} fill={`url(#${gid.wood})`} />
          <Rect x={woodX} y={woodY} width={woodW} height={woodH} rx={10} fill={`url(#${gid.sheen})`} />
          {grainLines.map((g, i) => (
            <Line
              key={`gr${i}`} x1={g.x} y1={woodY + 2} x2={g.x2} y2={woodY + woodH - 2}
              stroke="rgb(40,28,16)" strokeOpacity={0.068} strokeWidth={1}
            />
          ))}
          {planks.map((p, i) => (
            <Rect
              key={i} x={p.x} y={woodY} width={p.w}
              height={woodH} fill={board.grain} opacity={p.o}
            />
          ))}
          <Rect
            x={woodX + 1} y={woodY + 1} width={woodW - 2} height={woodH - 2} rx={9.5}
            fill="none" stroke="rgba(45,30,12,0.24)" strokeWidth={2}
          />

          {rows.map((r) => (
            <Line
              key={`h${r}`}
              x1={lineX0} y1={px(r)} x2={lineX1} y2={px(r)}
              stroke={board.line} strokeWidth={0.8}
            />
          ))}
          {cols.map((c) => (
            <Line
              key={`v${c}`}
              x1={px(c)} y1={lineY0} x2={px(c)} y2={lineY1}
              stroke={board.line} strokeWidth={0.8}
            />
          ))}

          {cols.map((c) => (
            <SvgText
              key={`ct${c}`} x={px(c)} y={woodY - 4} textAnchor="middle"
              fontSize={8} fill={board.coordText} letterSpacing={0.5}
              fontFamily="InterV"
            >
              {GTP_COLS[c]}
            </SvgText>
          ))}
          {rows.map((r) => (
            <G key={`rt${r}`}>
              <SvgText
                x={woodX - 5.5} y={px(r) + 3} textAnchor="middle"
                fontSize={8} fill={board.coordText} fontFamily="InterV"
              >
                {String(size - r)}
              </SvgText>
              <SvgText
                x={woodX + woodW + 5.5} y={px(r) + 3} textAnchor="middle"
                fontSize={8} fill={board.coordText} fontFamily="InterV"
              >
                {String(size - r)}
              </SvgText>
            </G>
          ))}

          {zone && (
            // H1: полупрозрачное лавандовое гало зоны поиска — «смотри сюда»,
            // без указания точки. Под камнями, поверх сетки.
            <Rect
              x={px(Math.max(zone.c0, v.c0)) - CELL * 0.45}
              y={px(Math.max(zone.r0, v.r0)) - CELL * 0.45}
              width={(Math.min(zone.c1, v.c1) - Math.max(zone.c0, v.c0)) * CELL + CELL * 0.9}
              height={(Math.min(zone.r1, v.r1) - Math.max(zone.r0, v.r0)) * CELL + CELL * 0.9}
              rx={8}
              fill="rgba(139,124,246,0.14)"
              stroke="rgba(139,124,246,0.55)"
              strokeWidth={1.6}
              strokeDasharray="5 4"
            />
          )}

          {hoshiPoints(size)
            .filter(([c, r]) => c >= v.c0 && c <= v.c1 && r >= v.r0 && r <= v.r1)
            .map(([c, r]) => (
              <Circle key={`h${c}-${r}`} cx={px(c)} cy={px(r)} r={2.2} fill={board.hoshi} />
            ))}

          {Array.from(position).map((cell, at) =>
            cell === '.' || !inView(at) ? null : renderStone(
              at,
              cell as 'b' | 'w',
              numbers?.has(at) ? String(numbers.get(at)) : undefined,
              lastMove === at
            )
          )}

          {lastMove != null && position[lastMove] !== '.' && !numbers?.has(lastMove)
            && inView(lastMove) && (
            <G>
              {/* smooth gaussian-like falloff faked with many fading strokes */}
              {[
                { dr: 3, a: 0.26 }, { dr: 5, a: 0.19 }, { dr: 6.8, a: 0.13 },
                { dr: 8.4, a: 0.08 }, { dr: 9.8, a: 0.04 }, { dr: 11, a: 0.02 },
              ].map(({ dr, a }) => (
                <Circle
                  key={`halo${dr}`}
                  cx={px(colOf(lastMove))} cy={px(rowOf(lastMove))} r={stoneR + dr}
                  fill="none" stroke={`rgba(232,205,160,${a})`} strokeWidth={2.4}
                />
              ))}
              <Circle
                cx={px(colOf(lastMove))} cy={px(rowOf(lastMove))} r={stoneR + 1.5}
                fill="none" stroke="rgba(232,217,190,0.55)" strokeWidth={2.6}
              />
            </G>
          )}

          {ghosts.filter((g) => inView(g.at)).map((g) => (
            <G key={`g${g.at}`} opacity={board.ghostOpacity}>
              <Circle
                cx={px(colOf(g.at))} cy={px(rowOf(g.at))} r={stoneR}
                fill={g.color === 'b' ? stones.black.fill[1] : stones.white.fill[1]}
                stroke={g.color === 'w' ? stones.white.stroke : undefined}
                strokeWidth={0.6}
              />
              {g.label && (
                <SvgText
                  x={px(colOf(g.at))} y={px(rowOf(g.at)) + 4} textAnchor="middle"
                  fontSize={11} fontWeight="700" fontFamily="InterV"
                  fill={g.color === 'b' ? stones.black.text : stones.white.text}
                >
                  {g.label}
                </SvgText>
              )}
            </G>
          ))}

          {marks.filter((m) => inView(m.at)).map((m) => {
            const cx = px(colOf(m.at));
            const cy = px(rowOf(m.at));
            const onStone = position[m.at] !== '.';
            const markColor = onStone
              ? (position[m.at] === 'b' ? stones.black.text : stones.white.text)
              : board.letter;
            if (m.kind === 'triangle') {
              return (
                <Polygon
                  key={`m${m.at}`}
                  points={`${cx},${cy - 5.8} ${cx - 5.2},${cy + 3.6} ${cx + 5.2},${cy + 3.6}`}
                  fill={markColor} opacity={0.9}
                />
              );
            }
            if (m.kind === 'dot') {
              // Book continuation from a mid-branch position — the small
              // violet dot from the reference screen, not a letter.
              return (
                <Circle
                  key={`m${m.at}`} cx={cx} cy={cy} r={4.4}
                  fill="#8B7CF6" opacity={0.95}
                />
              );
            }
            if (m.kind === 'square') {
              return (
                <Rect
                  key={`m${m.at}`} x={cx - 4.5} y={cy - 4.5} width={9} height={9}
                  fill={markColor} opacity={0.9}
                />
              );
            }
            return (
              <G key={`m${m.at}`}>
                {!onStone && (
                  <Circle
                    cx={cx} cy={cy} r={8.5} fill={board.wood[1]} opacity={0.92}
                    stroke={board.line} strokeWidth={0.8}
                  />
                )}
                <SvgText
                  x={cx} y={cy + 4} textAnchor="middle"
                  fontSize={12} fontWeight="800" fill={markColor} fontFamily="InterV"
                >
                  {m.label ?? ''}
                </SvgText>
              </G>
            );
          })}
        </Svg>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: '100%', alignItems: 'center' },
  square: { width: '100%', maxWidth: 480 },
});
