import React from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import Svg, {
  Rect, Line, Circle, Text as SvgText, Polygon, Defs, RadialGradient,
  LinearGradient, Stop, G, Ellipse,
} from 'react-native-svg';
import { SIZE, GTP_COLS, colOf, rowOf, idx } from '../engine/board';
import { useTheme } from '../theme/ThemeContext';

const CELL = 24;
const PAD = 26;
const BOARD_PX = PAD * 2 + CELL * (SIZE - 1);
const px = (i: number) => PAD + i * CELL;

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

interface GobanProps {
  /** 81-char position string. */
  position: string;
  /** Move numbers by board index (optional). */
  numbers?: Map<number, number>;
  lastMove?: number | null;
  marks?: GobanMark[];
  ghosts?: GhostStone[];
  onPoint?: (at: number) => void;
  disabled?: boolean;
}

function Stone({ at, color, numText, hot }: {
  at: number; color: 'b' | 'w'; numText?: string; hot?: boolean;
}) {
  const { stones, board } = useTheme();
  const s = color === 'b' ? stones.black : stones.white;
  const cx = px(colOf(at));
  const cy = px(rowOf(at));
  const gradId = `stone-${color}`;
  return (
    <G>
      {stones.shadowOpacity > 0 && (
        <Ellipse
          cx={cx + 0.8} cy={cy + 1.6} rx={11} ry={10.4}
          fill={stones.shadow} opacity={stones.shadowOpacity}
        />
      )}
      <Circle
        cx={cx} cy={cy} r={11}
        fill={`url(#${gradId})`}
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
}

export default function Goban({
  position, numbers, lastMove, marks = [], ghosts = [], onPoint, disabled,
}: GobanProps) {
  const { board, stones } = useTheme();

  const handlePress = (evt: { nativeEvent: { locationX: number; locationY: number } }) => {
    if (!onPoint || disabled) return;
    const { locationX, locationY } = evt.nativeEvent;
    // Pressable is stretched to the rendered square; convert to grid.
    const scale = BOARD_PX / layoutSize.current;
    const c = Math.round((locationX * scale - PAD) / CELL);
    const r = Math.round((locationY * scale - PAD) / CELL);
    if (c < 0 || r < 0 || c >= SIZE || r >= SIZE) return;
    onPoint(idx(c, r));
  };

  const layoutSize = React.useRef(BOARD_PX);

  return (
    <View style={styles.wrap}>
      <Pressable
        onPress={handlePress}
        onLayout={(e) => { layoutSize.current = e.nativeEvent.layout.width; }}
        style={styles.square}
      >
        <Svg viewBox={`0 0 ${BOARD_PX} ${BOARD_PX}`} width="100%" height="100%">
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

          <Rect x={0} y={0} width={BOARD_PX} height={BOARD_PX} rx={8} fill="url(#wood)" />
          {/* Wood grain: a few soft horizontal streaks. */}
          {[0.18, 0.34, 0.52, 0.71, 0.88].map((t, i) => (
            <Rect
              key={i} x={0} y={BOARD_PX * t} width={BOARD_PX}
              height={1.6 + (i % 3)} fill={board.grain} opacity={board.grainOpacity}
            />
          ))}

          {Array.from({ length: SIZE }, (_, i) => (
            <G key={i}>
              <Line
                x1={px(0)} y1={px(i)} x2={px(SIZE - 1)} y2={px(i)}
                stroke={i === 0 || i === SIZE - 1 ? board.edgeLine : board.line}
                strokeWidth={i === 0 || i === SIZE - 1 ? 1.7 : 0.9}
              />
              <Line
                x1={px(i)} y1={px(0)} x2={px(i)} y2={px(SIZE - 1)}
                stroke={i === 0 || i === SIZE - 1 ? board.edgeLine : board.line}
                strokeWidth={i === 0 || i === SIZE - 1 ? 1.7 : 0.9}
              />
              <SvgText
                x={px(i)} y={px(0) - 13} textAnchor="middle" fontSize={9}
                fill={board.coordText}
              >
                {GTP_COLS[i]}
              </SvgText>
              <SvgText
                x={px(0) - 15} y={px(i) + 3} textAnchor="middle" fontSize={9}
                fill={board.coordText}
              >
                {String(SIZE - i)}
              </SvgText>
            </G>
          ))}

          {[[2, 2], [6, 2], [4, 4], [2, 6], [6, 6]].map(([c, r]) => (
            <Circle key={`${c}-${r}`} cx={px(c)} cy={px(r)} r={2.6} fill={board.hoshi} />
          ))}

          {Array.from(position).map((cell, at) =>
            cell === '.' ? null : (
              <Stone
                key={at}
                at={at}
                color={cell as 'b' | 'w'}
                numText={numbers?.has(at) ? String(numbers.get(at)) : undefined}
                hot={lastMove === at}
              />
            )
          )}

          {lastMove != null && position[lastMove] !== '.' && !numbers?.has(lastMove) && (
            <Circle
              cx={px(colOf(lastMove))} cy={px(rowOf(lastMove))} r={4.6}
              fill="none" stroke={board.letter} strokeWidth={1.6}
            />
          )}

          {ghosts.map((g) => (
            <G key={`g${g.at}`} opacity={board.ghostOpacity}>
              <Circle
                cx={px(colOf(g.at))} cy={px(rowOf(g.at))} r={11}
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

          {marks.map((m) => {
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
                {!onStone && <Circle cx={cx} cy={cy} r={9.5} fill={board.wood[1]} />}
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
  square: { width: '100%', maxWidth: 440, aspectRatio: 1 },
});
