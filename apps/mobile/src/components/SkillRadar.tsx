// «Звезда навыков» — N-осевая паутинка (референс: экран Обучение).
// После консилиума v2: читаемая сетка из концентрических уровней, яркий
// светящийся полигон текущего уровня (стек полупрозрачных обводок вместо
// blur), приглушённый пунктир потенциала, компактный центральный медальон
// и лёгкие узлы-маркеры вместо крупных кнопок.

import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import Svg, { Polygon, Line, Circle } from 'react-native-svg';
import DomainIcon from './DomainIcon';
import { ui } from '../theme/uiTheme';
import { useT } from '../i18n';

export interface RadarAxis {
  key: string;
  label: string;
  solved: number;
  total: number;
  value: number; // 0..1 — радиус полигона
  color: string;
}

const NODE_GAP = 44;    // от вершины до центра узла-иконки
const NODE_HALF = 44;   // половина высоты стека узла
const NODE_W = 118;     // ширина контейнера подписи

export default function SkillRadar({
  axes, rating, width, onSelect,
}: {
  axes: RadarAxis[]; rating: number; width: number;
  onSelect?: (key: string) => void;
}) {
  const t = useT();
  const n = axes.length;
  const R = width / 2 - 76; // запас под подписи узлов
  const cx = width / 2;
  const height = 2 * (R + NODE_GAP + NODE_HALF);
  const cy = height / 2;
  const coreR = Math.max(40, R * 0.42);

  const dir = (i: number) => {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / n;
    return { x: Math.cos(a), y: Math.sin(a) };
  };
  const pt = (i: number, r: number) => {
    const d = dir(i);
    return { x: cx + d.x * r, y: cy + d.y * r };
  };
  const ring = (frac: number) =>
    axes.map((_, i) => { const p = pt(i, R * frac); return `${p.x},${p.y}`; }).join(' ');

  const valuePts = axes.map((a, i) => pt(i, R * Math.max(0.1, Math.min(1, a.value))));
  const valueStr = valuePts.map((p) => `${p.x},${p.y}`).join(' ');

  return (
    <View style={{ width, height }}>
      <Svg width={width} height={height}>
        {/* сетка: концентрические уровни, читаемая «паутина» */}
        {[0.25, 0.5, 0.75].map((f) => (
          <Polygon key={f} points={ring(f)} fill="none"
            stroke="#6655A6" strokeOpacity={0.30} strokeWidth={1} />
        ))}
        {/* спицы */}
        {axes.map((_, i) => {
          const p = pt(i, R);
          return (
            <Line key={`sp${i}`} x1={cx} y1={cy} x2={p.x} y2={p.y}
              stroke="#695AA7" strokeOpacity={0.42} strokeWidth={1} />
          );
        })}
        {/* потенциал: тихий пунктирный контур + полые вершины */}
        <Polygon points={ring(1)} fill="none"
          stroke="#A0A5B2" strokeOpacity={0.45} strokeWidth={1} strokeDasharray="3 5" />
        {axes.map((_, i) => {
          const p = pt(i, R);
          return (
            <Circle key={`hv${i}`} cx={p.x} cy={p.y} r={3}
              stroke="rgba(255,255,255,0.38)" strokeWidth={1} fill={ui.bg} />
          );
        })}
        {/* текущий уровень: свечение стеком обводок + заливка + яркий контур */}
        <Polygon points={valueStr} fill="none" stroke="#7C5CFF"
          strokeOpacity={0.05} strokeWidth={18} strokeLinejoin="round" />
        <Polygon points={valueStr} fill="none" stroke="#7C5CFF"
          strokeOpacity={0.09} strokeWidth={10} strokeLinejoin="round" />
        <Polygon points={valueStr} fill="none" stroke="#8F6FFF"
          strokeOpacity={0.16} strokeWidth={5} strokeLinejoin="round" />
        <Polygon points={valueStr} fill="#714DDB" fillOpacity={0.32} stroke="none" />
        <Polygon points={valueStr} fill="none" stroke="#9A78FF"
          strokeWidth={1.8} strokeLinejoin="round" />
        {valuePts.map((p, i) => (
          <React.Fragment key={`vv${i}`}>
            <Circle cx={p.x} cy={p.y} r={5.5} fill="rgba(157,140,255,0.30)" />
            <Circle cx={p.x} cy={p.y} r={2.8} fill="#CFC6FF" />
          </React.Fragment>
        ))}
        {/* центр: компактный медальон, сквозь который читается звезда */}
        <Circle cx={cx} cy={cy} r={coreR + 9} fill="rgba(90,67,163,0.10)" />
        <Circle cx={cx} cy={cy} r={coreR} fill="rgba(20,20,43,0.90)"
          stroke="rgba(122,102,189,0.55)" strokeWidth={1} />
      </Svg>

      {/* рейтинг в центре */}
      <View style={[styles.center, {
        left: cx - coreR, top: cy - coreR,
        width: coreR * 2, height: coreR * 2, borderRadius: coreR,
      }]}>
        <Text style={styles.rating} maxFontSizeMultiplier={1.1}>{rating}</Text>
        <Text style={styles.ratingSub} maxFontSizeMultiplier={1.1}>{t('overall_rating')}</Text>
      </View>

      {/* узлы доменов — лёгкие маркеры, продолжающие оси; тап = тренировка темы */}
      {axes.map((a, i) => {
        const d = dir(i);
        const nx = cx + d.x * (R + NODE_GAP);
        const ny = cy + d.y * (R + NODE_GAP);
        const left = Math.min(Math.max(nx - NODE_W / 2, 2), width - NODE_W - 2);
        return (
          <Pressable
            key={a.key}
            onPress={onSelect ? () => onSelect(a.key) : undefined}
            disabled={!onSelect}
            style={({ pressed }) => [
              styles.node, { left, top: ny - NODE_HALF, width: NODE_W },
              pressed && styles.nodePressed,
            ]}
          >
            <View style={[styles.iconWrap, { borderColor: a.color + '66' }]}>
              <DomainIcon domain={a.key} size={24} />
            </View>
            <Text style={styles.nodeLabel} numberOfLines={1} maxFontSizeMultiplier={1.05}>
              {a.label}
            </Text>
            <Text style={styles.nodeCount} maxFontSizeMultiplier={1.05}>
              {a.solved}
              <Text style={styles.nodeTotal}>/{a.total}</Text>
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  rating: {
    fontSize: 26, fontFamily: ui.serif, color: '#E9E3E0',
    fontVariant: ['tabular-nums'],
  },
  ratingSub: { fontSize: 10, color: '#92909A', marginTop: 1 },
  node: { position: 'absolute', alignItems: 'center' },
  nodePressed: { opacity: 0.55, transform: [{ scale: 0.94 }] },
  iconWrap: {
    width: 40, height: 40, borderRadius: 20, alignItems: 'center',
    justifyContent: 'center', backgroundColor: 'rgba(91,72,160,0.14)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)', marginBottom: 5,
  },
  nodeLabel: { fontSize: 12, fontWeight: '500', color: ui.inkSoft },
  nodeCount: { fontSize: 12, color: ui.inkSoft, fontVariant: ['tabular-nums'], marginTop: 1 },
  nodeTotal: { color: '#858A98' },
});
