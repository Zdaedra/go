// The hero CTA from the approved design: dark lacquer pill, a warm ring
// whose light peaks at the upper-left (rose-pink) and cools toward the
// lower-right (copper), and a lavender dome arc floating above the pill
// with a cool haze between arc and edge. Ring/arc values were measured
// off the source mockup (docs/design/README.md).

import React, { useState } from 'react';
import { Pressable, Text, StyleSheet, StyleProp, ViewStyle, TextStyle } from 'react-native';
import Svg, { Defs, LinearGradient, Stop, Rect, Path } from 'react-native-svg';

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
            <LinearGradient id="warmRing" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor="#F1A6AD" />
              <Stop offset="0.4" stopColor="#CE86A0" />
              <Stop offset="0.72" stopColor="#C98870" />
              <Stop offset="1" stopColor="#A17353" />
            </LinearGradient>
            <LinearGradient id="domeHaze" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor="#3E346C" stopOpacity="0.5" />
              <Stop offset="1" stopColor="#241F3A" stopOpacity="0" />
            </LinearGradient>
          </Defs>
          {dome && dim.w > 80 && (
            <>
              <Path
                d={`M ${dim.w * 0.11} 0 Q ${dim.w / 2} ${-2 * DOME_H} ${dim.w * 0.89} 0 Z`}
                fill="url(#domeHaze)"
              />
              <Path
                d={`M ${dim.w * 0.11} 0 Q ${dim.w / 2} ${-2 * DOME_H} ${dim.w * 0.89} 0`}
                stroke="rgba(108,97,190,0.95)" strokeWidth={1.4} fill="none"
              />
            </>
          )}
          <Rect
            x={0.8} y={0.8} width={dim.w - 1.6} height={dim.h - 1.6}
            rx={RADIUS} stroke="url(#warmRing)" strokeWidth={1.6} fill="none"
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
