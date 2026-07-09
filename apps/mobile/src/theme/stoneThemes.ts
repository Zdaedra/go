// Stone visual themes, independent from board themes.
// Stones are drawn as SVG circles with radial gradients: an offset
// highlight gives the classic slate-and-shell volume.

export interface StoneStyle {
  /** Radial gradient stops, center-out. */
  fill: [string, string, string];
  /** Highlight circle color + opacity (specular). */
  highlight: string;
  highlightOpacity: number;
  stroke: string;
  strokeWidth: number;
  /** Move-number / mark color on this stone. */
  text: string;
}

export interface StoneTheme {
  id: string;
  nameRu: string;
  black: StoneStyle;
  white: StoneStyle;
  /** Drop shadow under stones. */
  shadow: string;
  shadowOpacity: number;
}

export const stoneThemes: Record<string, StoneTheme> = {
  shell: {
    id: 'shell',
    nameRu: 'Сланец и ракушка',
    black: {
      fill: ['#5C5C58', '#232322', '#0D0D0C'],
      highlight: '#FFFFFF', highlightOpacity: 0.28,
      stroke: 'none', strokeWidth: 0,
      text: '#F2EFE7',
    },
    white: {
      fill: ['#FFFFFF', '#F4F1E8', '#D9D3C2'],
      highlight: '#FFFFFF', highlightOpacity: 0.85,
      stroke: '#B5AD98', strokeWidth: 0.5,
      text: '#26221B',
    },
    shadow: '#000000', shadowOpacity: 0.28,
  },
  matte: {
    id: 'matte',
    nameRu: 'Матовые',
    black: {
      fill: ['#3A3A38', '#242423', '#1A1A19'],
      highlight: '#FFFFFF', highlightOpacity: 0.1,
      stroke: 'none', strokeWidth: 0,
      text: '#EFEDE6',
    },
    white: {
      fill: ['#F4F2EC', '#ECE9E0', '#E0DCCF'],
      highlight: '#FFFFFF', highlightOpacity: 0.4,
      stroke: '#A9A28E', strokeWidth: 0.6,
      text: '#26221B',
    },
    shadow: '#000000', shadowOpacity: 0.16,
  },
  glass: {
    id: 'glass',
    nameRu: 'Стекло',
    black: {
      fill: ['#4E6E68', '#1E3532', '#0C1917'],
      highlight: '#DFF5F0', highlightOpacity: 0.5,
      stroke: '#0C1917', strokeWidth: 0.4,
      text: '#E8F2EF',
    },
    white: {
      fill: ['#FFFFFF', '#EAF3F1', '#C8DAD6'],
      highlight: '#FFFFFF', highlightOpacity: 0.95,
      stroke: '#9DB4AF', strokeWidth: 0.6,
      text: '#1E3532',
    },
    shadow: '#0C1917', shadowOpacity: 0.24,
  },
  flat: {
    id: 'flat',
    nameRu: 'Плоские',
    black: {
      fill: ['#1C1917', '#1C1917', '#1C1917'],
      highlight: '#FFFFFF', highlightOpacity: 0,
      stroke: 'none', strokeWidth: 0,
      text: '#F2EFE7',
    },
    white: {
      fill: ['#F6F3EC', '#F6F3EC', '#F6F3EC'],
      highlight: '#FFFFFF', highlightOpacity: 0,
      stroke: '#4A3B24', strokeWidth: 0.9,
      text: '#1C1917',
    },
    shadow: '#000000', shadowOpacity: 0,
  },
};

export const defaultStoneTheme = 'shell';
