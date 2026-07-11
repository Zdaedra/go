// Цветные SVG-иконки навыков (домены цумэго) для звезды навыков и
// прогресс-карточек. Один стиль: тонкие штрихи + мягкая заливка,
// у каждого домена свой акцентный цвет (референс: docs/design).

import React from 'react';
import Svg, { Path, Circle, G, Line, Rect } from 'react-native-svg';

export const DOMAIN_COLORS: Record<string, string> = {
  capture: '#F0A878',   // оранжевый самоцвет
  'ld-live': '#8B7CF6', // фиолетовые фигурки
  'ld-kill': '#6FA8DC', // голубые мечи
  ko: '#5BC8D6',        // бирюзовая мишень
  race: '#7CBF6B',      // зелёный флаг
  connect: '#58C6A9',   // мятные звенья
};

export default function DomainIcon({
  domain, size = 22, color,
}: { domain: string; size?: number; color?: string }) {
  const c = color ?? DOMAIN_COLORS[domain] ?? '#8B7CF6';
  const common = { width: size, height: size, viewBox: '0 0 24 24' };
  switch (domain) {
    case 'capture': // гранёный камень-самоцвет
      return (
        <Svg {...common}>
          <Path
            d="M7 4h10l4 5-9 11L3 9l4-5z"
            fill={c} opacity={0.28}
          />
          <Path
            d="M7 4h10l4 5-9 11L3 9l4-5z"
            stroke={c} strokeWidth={1.6} strokeLinejoin="round" fill="none"
          />
          <Path d="M3 9h18M7 4l5 5 5-5M12 9v11" stroke={c} strokeWidth={1.1} opacity={0.8} fill="none" />
        </Svg>
      );
    case 'ld-live': // три фигурки-группа
      return (
        <Svg {...common}>
          <Circle cx={12} cy={7.2} r={2.7} stroke={c} strokeWidth={1.6} fill={`${c}44`} />
          <Path d="M7 18.6c0-2.9 2.2-4.8 5-4.8s5 1.9 5 4.8" stroke={c} strokeWidth={1.6} fill="none" strokeLinecap="round" />
          <Circle cx={5.4} cy={9} r={2} stroke={c} strokeWidth={1.3} fill="none" opacity={0.75} />
          <Circle cx={18.6} cy={9} r={2} stroke={c} strokeWidth={1.3} fill="none" opacity={0.75} />
          <Path d="M2.6 17.4c0-2 1.3-3.4 3.1-3.8M21.4 17.4c0-2-1.3-3.4-3.1-3.8"
            stroke={c} strokeWidth={1.3} fill="none" strokeLinecap="round" opacity={0.75} />
        </Svg>
      );
    case 'ld-kill': // скрещённые мечи
      return (
        <Svg {...common}>
          <G stroke={c} strokeWidth={1.6} strokeLinecap="round">
            <Line x1={5} y1={4} x2={17.5} y2={16.5} />
            <Line x1={19} y1={4} x2={6.5} y2={16.5} />
            <Line x1={15.6} y1={18.4} x2={19.4} y2={14.6} />
            <Line x1={4.6} y1={14.6} x2={8.4} y2={18.4} />
            <Line x1={17} y1={20} x2={20} y2={17} strokeWidth={2.2} />
            <Line x1={4} y1={17} x2={7} y2={20} strokeWidth={2.2} />
          </G>
        </Svg>
      );
    case 'ko': // мишень: повторяющиеся круги
      return (
        <Svg {...common}>
          <Circle cx={12} cy={12} r={8.4} stroke={c} strokeWidth={1.5} fill="none" opacity={0.85} />
          <Circle cx={12} cy={12} r={4.6} stroke={c} strokeWidth={1.5} fill={`${c}2e`} />
          <Circle cx={12} cy={12} r={1.5} fill={c} />
        </Svg>
      );
    case 'race': // флаг финиша гонки
      return (
        <Svg {...common}>
          <Line x1={6} y1={3.5} x2={6} y2={20.5} stroke={c} strokeWidth={1.8} strokeLinecap="round" />
          <Path d="M6 4.5c3.2-1.6 6.2 1.4 11.5 0v8c-5.3 1.4-8.3-1.6-11.5 0z"
            stroke={c} strokeWidth={1.5} fill={`${c}38`} strokeLinejoin="round" />
        </Svg>
      );
    case 'connect': // два звена цепи
      return (
        <Svg {...common}>
          <G stroke={c} strokeWidth={1.7} fill="none" strokeLinecap="round">
            <Path d="M10.2 13.8 8 16a3.6 3.6 0 0 1-5.1-5.1l3-3a3.6 3.6 0 0 1 5.1 0" />
            <Path d="M13.8 10.2 16 8a3.6 3.6 0 0 1 5.1 5.1l-3 3a3.6 3.6 0 0 1-5.1 0" />
          </G>
        </Svg>
      );
    default:
      return (
        <Svg {...common}>
          <Rect x={5} y={5} width={14} height={14} rx={4} stroke={c} strokeWidth={1.6} fill={`${c}30`} />
        </Svg>
      );
  }
}
