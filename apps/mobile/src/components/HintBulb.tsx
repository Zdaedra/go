// Stroked lavender lightbulb — the Hint glyph from the approved design
// (replaces the platform 💡 emoji, which breaks the monochrome+accent UI).

import React from 'react';
import Svg, { Path } from 'react-native-svg';

export default function HintBulb({ size = 15, color = '#A78BFA' }: {
  size?: number; color?: string;
}) {
  return (
    <Svg width={size} height={size * 17 / 15} viewBox="0 0 15 17" fill="none">
      <Path
        d="M7.5 1.2a5 5 0 0 1 5 5c0 2-1.1 3.1-2 4.1-.5.6-.8 1-.8 1.7H5.3c0-.7-.3-1.1-.8-1.7-.9-1-2-2.1-2-4.1a5 5 0 0 1 5-5z"
        stroke={color} strokeWidth={1.4} strokeLinecap="round"
      />
      <Path d="M5.6 14.4h3.8M6.3 16.1h2.4" stroke={color} strokeWidth={1.4} strokeLinecap="round" />
    </Svg>
  );
}
