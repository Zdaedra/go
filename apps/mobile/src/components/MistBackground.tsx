// Atmospheric mist behind screen content — overlapping soft ellipses whose
// ridge line undulates, mirroring the approved reference (docs/design,
// screens/app.css body::before). Peaks #181A1A over the #121213 field.

import React from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Defs, RadialGradient, Stop, Ellipse } from 'react-native-svg';

// cx, cy, rx, ry in the 427×922 reference viewport; a = band opacity.
const BANDS = [
  { cx: 68, cy: 397, rx: 239, ry: 138, a: 0.95 },
  { cx: 248, cy: 369, rx: 188, ry: 101, a: 0.7 },
  { cx: 393, cy: 424, rx: 265, ry: 129, a: 0.85 },
  { cx: 162, cy: 415, rx: 162, ry: 83, a: 0.55 },
  { cx: 94, cy: 710, rx: 248, ry: 120, a: 0.9 },
  { cx: 290, cy: 673, rx: 196, ry: 92, a: 0.65 },
  { cx: 410, cy: 728, rx: 222, ry: 111, a: 0.8 },
];

export default function MistBackground() {
  // Unique per instance: on web all mounted SVGs share one document, and a
  // duplicate id resolves into a hidden tab whose defs don't render.
  const uid = React.useId().replace(/[^a-zA-Z0-9]/g, '');
  const id = `mist-${uid}`;
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Svg
        width="100%" height="100%"
        viewBox="0 0 427 922"
        preserveAspectRatio="xMidYMid slice"
      >
        <Defs>
          <RadialGradient id={id} cx="0.5" cy="0.5" r="0.5">
            <Stop offset="0" stopColor="#181A1A" stopOpacity="1" />
            <Stop offset="0.45" stopColor="#181A1A" stopOpacity="0.55" />
            <Stop offset="0.72" stopColor="#181A1A" stopOpacity="0" />
          </RadialGradient>
        </Defs>
        {BANDS.map((b, i) => (
          <Ellipse
            key={i} cx={b.cx} cy={b.cy} rx={b.rx} ry={b.ry}
            fill={`url(#${id})`} fillOpacity={b.a}
          />
        ))}
      </Svg>
    </View>
  );
}
