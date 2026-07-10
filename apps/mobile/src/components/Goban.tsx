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
  onPoint, disabled,
}: GobanProps) {
  const { board, stones } = useTheme();
  const layoutSize = React.useRef(1);

  const v: ViewRect = view ?? { c0: 0, r0: 0, c1: size - 1, r1: size - 1 };
  const px = (i: number) => PAD + i * CELL;
  const colOf = (i: number) => i % size;
  const rowOf = (i: number) => Math.floor(i / size);

  // Coordinates live OUTSIDE the wood slab on the page ground (reference
  // design); cropped boards label only the visible range.
  const GUTTER = 22;
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
  // Grid lines stop at the true board edge, run to the crop border otherwise.
  const lineX0 = px(v.c0) - (v.c0 > 0 ? PAD * 0.55 : 0);
  const lineX1 = px(v.c1) + (v.c1 < size - 1 ? PAD * 0.55 : 0);
  const lineY0 = px(v.r0) - (v.r0 > 0 ? PAD * 0.55 : 0);
  const lineY1 = px(v.r1) + (v.r1 < size - 1 ? PAD * 0.55 : 0);

  const stoneR = 11;

  const renderStone = (at: number, color: 'b' | 'w', numText?: string, hot?: boolean) => {
    const s = color === 'b' ? stones.black : stones.white;
    const cx = px(colOf(at));
    const cy = px(rowOf(at));
    return (
      <G key={`s${at}`}>
        {stones.shadowOpacity > 0 && (
          <Ellipse
            cx={cx + 0.8} cy={cy + 1.6} rx={stoneR} ry={stoneR - 0.6}
            fill={stones.shadow} opacity={stones.shadowOpacity}
          />
        )}
        <Circle
          cx={cx} cy={cy} r={stoneR}
          fill={`url(#stone-${color})`}
          stroke={s.stroke === 'none' ? undefined : s.stroke}
          strokeWidth={s.strokeWidth}
        />
        {s.highlightOpacity > 0 && (
          <Ellipse
            cx={cx - 3.6} cy={cy - 4.2} rx={4.6} ry={3.2}
            fill={s.highlight} opacity={s.highlightOpacity * 0.55}
          />
        )}
        {numText != null && (
          <SvgText
            x={cx} y={cy + 3.8} textAnchor="middle"
            fontSize={numText.length > 2 ? 8.5 : 10.5}
            fontWeight={hot ? '800' : '600'}
            fill={hot ? board.letter : s.text}
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
            <LinearGradient id="wood" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={board.wood[0]} />
              <Stop offset="0.55" stopColor={board.wood[1]} />
              <Stop offset="1" stopColor={board.wood[2]} />
            </LinearGradient>
            <RadialGradient id="stone-b" cx="0.35" cy="0.3" r="0.9">
              <Stop offset="0" stopColor={stones.black.fill[0]} />
              <Stop offset="0.45" stopColor={stones.black.fill[1]} />
              <Stop offset="1" stopColor={stones.black.fill[2]} />
            </RadialGradient>
            <RadialGradient id="stone-w" cx="0.35" cy="0.3" r="0.9">
              <Stop offset="0" stopColor={stones.white.fill[0]} />
              <Stop offset="0.5" stopColor={stones.white.fill[1]} />
              <Stop offset="1" stopColor={stones.white.fill[2]} />
            </RadialGradient>
          </Defs>

          <Rect x={woodX} y={woodY} width={woodW} height={woodH} rx={10} fill="url(#wood)" />
          {[0.09, 0.22, 0.38, 0.47, 0.63, 0.78, 0.9].map((t, i) => (
            <Rect
              key={i} x={woodX + woodW * t} y={woodY} width={1 + (i % 3) * 1.4}
              height={woodH} fill={board.grain} opacity={board.grainOpacity * (0.6 + (i % 2) * 0.5)}
            />
          ))}
          <Rect
            x={woodX + 1} y={woodY + 1} width={woodW - 2} height={woodH - 2} rx={9.5}
            fill="none" stroke="rgba(45,30,12,0.28)" strokeWidth={2}
          />

          {rows.map((r) => (
            <Line
              key={`h${r}`}
              x1={lineX0} y1={px(r)} x2={lineX1} y2={px(r)}
              stroke={r === 0 || r === size - 1 ? board.edgeLine : board.line}
              strokeWidth={r === 0 || r === size - 1 ? 1.7 : 0.9}
            />
          ))}
          {cols.map((c) => (
            <Line
              key={`v${c}`}
              x1={px(c)} y1={lineY0} x2={px(c)} y2={lineY1}
              stroke={c === 0 || c === size - 1 ? board.edgeLine : board.line}
              strokeWidth={c === 0 || c === size - 1 ? 1.7 : 0.9}
            />
          ))}

          {cols.map((c) => (
            <SvgText
              key={`ct${c}`} x={px(c)} y={woodY - 9} textAnchor="middle"
              fontSize={9.5} fill={board.coordText} letterSpacing={0.5}
            >
              {GTP_COLS[c]}
            </SvgText>
          ))}
          {rows.map((r) => (
            <G key={`rt${r}`}>
              <SvgText
                x={woodX - 11} y={px(r) + 3.5} textAnchor="middle"
                fontSize={9.5} fill={board.coordText}
              >
                {String(size - r)}
              </SvgText>
              <SvgText
                x={woodX + woodW + 11} y={px(r) + 3.5} textAnchor="middle"
                fontSize={9.5} fill={board.coordText}
              >
                {String(size - r)}
              </SvgText>
            </G>
          ))}

          {hoshiPoints(size)
            .filter(([c, r]) => c >= v.c0 && c <= v.c1 && r >= v.r0 && r <= v.r1)
            .map(([c, r]) => (
              <Circle key={`h${c}-${r}`} cx={px(c)} cy={px(r)} r={2.6} fill={board.hoshi} />
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
              <Circle
                cx={px(colOf(lastMove))} cy={px(rowOf(lastMove))} r={stoneR + 8}
                fill="none" stroke="rgba(238,205,160,0.14)" strokeWidth={12}
              />
              <Circle
                cx={px(colOf(lastMove))} cy={px(rowOf(lastMove))} r={stoneR + 3.5}
                fill="none" stroke="rgba(238,205,160,0.30)" strokeWidth={5}
              />
              <Circle
                cx={px(colOf(lastMove))} cy={px(rowOf(lastMove))} r={stoneR + 1.2}
                fill="none" stroke="rgba(240,214,176,0.5)" strokeWidth={2}
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
                  fontSize={11} fontWeight="700"
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
                  points={`${cx},${cy - 7.5} ${cx - 6.7},${cy + 4.5} ${cx + 6.7},${cy + 4.5}`}
                  fill="none" stroke={markColor} strokeWidth={1.5}
                />
              );
            }
            if (m.kind === 'square') {
              return (
                <Rect
                  key={`m${m.at}`} x={cx - 5.5} y={cy - 5.5} width={11} height={11}
                  fill="none" stroke={markColor} strokeWidth={1.5}
                />
              );
            }
            return (
              <G key={`m${m.at}`}>
                {!onStone && (
                  <Circle
                    cx={cx} cy={cy} r={9.5} fill={board.wood[1]} opacity={0.92}
                    stroke={board.line} strokeWidth={0.8}
                  />
                )}
                <SvgText
                  x={cx} y={cy + 4.5} textAnchor="middle"
                  fontSize={13} fontWeight="800" fill={markColor}
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
  square: { width: '100%', maxWidth: 440 },
});
