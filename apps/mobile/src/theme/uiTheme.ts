// App-wide design tokens, extracted from the approved reference screen
// (docs/design/screen1.html + replica_v13.png, validated by a two-judge
// design review against the mockup). Dark "ink & lacquer" identity:
// charcoal ground, hairline translucent cards, violet accent, serif
// display for names/titles, letterspaced uppercase labels.

export const ui = {
  // grounds
  bg: '#121213',
  card: 'rgba(5,7,7,0.68)',
  cardSolid: '#1A1715',
  hairline: 'rgba(255,255,255,0.08)',
  hairlineStrong: 'rgba(255,255,255,0.10)',

  // text
  ink: '#F2EFEA',
  inkSoft: '#E8E6E3',
  muted: '#8E8B85',
  dim: '#7E7B75',
  label: '#7B7872',

  // accents
  accent: '#8B7CF6',       // violet
  accentSoft: '#9D8CFF',
  lavender: '#C5BBF0',     // pale "Medium" tint
  peach: '#F0A878',
  warmGlow: 'rgba(240,201,164,0.6)',
  success: '#7B9464',
  danger: '#C96F5A',

  // board (night-luxe)
  woodTop: '#7A5F40',
  woodMid: '#77603F',
  woodBottom: '#624B32',
  woodLine: '#4A3A26',
  coordText: '#848484',

  // radii / spacing
  radiusCard: 16,
  radiusBoard: 10,
  radiusButton: 11,
  pad: 16,

  // typography
  serif: 'Playfair',
  sans: 'InterV',
} as const;

/** Letterspaced uppercase label (OPENING / YOUR TURN / NEW ...). */
export const eyebrow = {
  fontSize: 10,
  fontWeight: '600' as const,
  letterSpacing: 2.2,
  textTransform: 'uppercase' as const,
  color: ui.label,
};

export const eyebrowAccent = { ...eyebrow, color: ui.accentSoft };

export const cardStyle = {
  backgroundColor: ui.card,
  borderWidth: 1,
  borderColor: ui.hairline,
  borderRadius: ui.radiusCard,
};
