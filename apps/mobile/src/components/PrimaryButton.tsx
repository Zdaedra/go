// The hero CTA from the approved design: dark lacquer pill, a warm ring
// whose light peaks at the upper-left (rose-pink) and cools toward the
// lower-right (copper), and a lavender dome arc floating above the pill
// with a cool haze between arc and edge. Ring/arc values were measured
// off the source mockup (docs/design/README.md).

import React, { useState } from 'react';
import { Pressable, Text, StyleSheet, StyleProp, ViewStyle, TextStyle } from 'react-native';
import Svg, { Defs, LinearGradient, RadialGradient, Stop, Rect, Ellipse } from 'react-native-svg';

const DOME_H = 14;
const RADIUS = 12;

interface Props {
  label: string;
  onPress?: () => void;
  disabled?: boolean;
  /** Draw the lavender dome arc above the pill (hero placement). */
  dome?: boolean;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
}

export default function PrimaryButton({
  label, onPress, disabled, dome = true, style, textStyle,
}: Props) {
  const [dim, setDim] = useState({ w: 0, h: 0 });
  // Unique gradient ids per instance (web: duplicate ids resolve into
  // hidden screens whose defs don't render).
  const uid = React.useId().replace(/[^a-zA-Z0-9]/g, '');
  const ringId = `warmRing-${uid}`;
  const hazeId = `domeHaze-${uid}`;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      onLayout={(e) => setDim({
        w: e.nativeEvent.layout.width,
        h: e.nativeEvent.layout.height,
      })}
      style={({ pressed }) => [styles.btn, style, pressed && styles.pressed]}
    >
      {dim.w > 0 && (
        <Svg
          pointerEvents="none"
          style={[styles.ring, { top: -DOME_H }]}
          width={dim.w}
          height={dim.h + DOME_H}
          viewBox={`0 ${-DOME_H} ${dim.w} ${dim.h + DOME_H}`}
        >
          <Defs>
            <LinearGradient id={ringId} x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor="#E0A57D" />
              <Stop offset="0.45" stopColor="#D08F74" />
              <Stop offset="1" stopColor="#A17353" />
            </LinearGradient>
            <RadialGradient id={hazeId} cx="0.5" cy="1" r="1">
              <Stop offset="0" stopColor="#8B7CF6" stopOpacity="0.20" />
              <Stop offset="0.55" stopColor="#8B7CF6" stopOpacity="0.08" />
              <Stop offset="1" stopColor="#8B7CF6" stopOpacity="0" />
            </RadialGradient>
          </Defs>
          {dome && dim.w > 80 && (
            <Ellipse
              cx={dim.w / 2} cy={2} rx={dim.w * 0.44} ry={DOME_H * 2}
              fill={`url(#${hazeId})`}
            />
          )}
          <Rect
            x={0.6} y={0.6} width={dim.w - 1.2} height={dim.h - 1.2}
            rx={RADIUS} stroke={`url(#${ringId})`} strokeWidth={1.1} fill="none"
          />
        </Svg>
      )}
      <Text style={[styles.label, textStyle]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    backgroundColor: '#1A1720',
    borderRadius: RADIUS,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: DOME_H,
    shadowColor: '#000000', shadowOpacity: 0.3, shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 }, elevation: 4,
  },
  pressed: { opacity: 0.85 },
  ring: { position: 'absolute', left: 0 },
  label: { color: '#F2EFEA', fontSize: 16, fontWeight: '700' },
});
