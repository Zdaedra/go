// Board (goban) visual themes. Board and stone themes are selected
// independently in Settings. Each theme is pure draw parameters —
// adding a theme is adding an object, no component changes needed.
// Looks are inspired by open-source gobans (Sabaki, Lizzie, OGS).

export interface BoardTheme {
  id: string;
  nameRu: string;
  /** Background gradient stops, top to bottom. */
  wood: [string, string, string];
  /** Subtle horizontal grain streak color (drawn at low opacity). */
  grain: string;
  grainOpacity: number;
  line: string;
  edgeLine: string;
  hoshi: string;
  coordText: string;
  /** Color for variation letters (A, B, C...) drawn on empty points. */
  letter: string;
  /** Ghost-stone suggestion opacity. */
  ghostOpacity: number;
}

export const boardThemes: Record<string, BoardTheme> = {
  nightLuxe: {
    id: 'nightLuxe',
    nameRu: 'Ночной лак',
    wood: ['#8A6A44', '#836440', '#7E6040'],
    grain: '#54401F',
    grainOpacity: 0.14,
    line: '#4A3A26',
    edgeLine: '#3A2D1C',
    hoshi: '#241A0C',
    coordText: '#848484',
    letter: '#7C6EE0',
    ghostOpacity: 0.42,
  },
  kaya: {
    id: 'kaya',
    nameRu: 'Кайя (классика)',
    wood: ['#E8C476', '#DDB05C', '#D2A34E'],
    grain: '#B98E3F',
    grainOpacity: 0.18,
    line: '#4A3B24',
    edgeLine: '#3A2E1C',
    hoshi: '#3A2E1C',
    coordText: '#6B5530',
    letter: '#B23A2B',
    ghostOpacity: 0.38,
  },
  night: {
    id: 'night',
    nameRu: 'Тёмная',
    wood: ['#4B4238', '#3E362D', '#332C24'],
    grain: '#2A241D',
    grainOpacity: 0.3,
    line: '#B9A98E',
    edgeLine: '#CDBEA2',
    hoshi: '#CDBEA2',
    coordText: '#8F8168',
    letter: '#E06A50',
    ghostOpacity: 0.42,
  },
  walnut: {
    id: 'walnut',
    nameRu: 'Орех',
    wood: ['#9C6B3F', '#8A5A2F', '#7A4E27'],
    grain: '#5F3D1E',
    grainOpacity: 0.28,
    line: '#2E2012',
    edgeLine: '#241A0F',
    hoshi: '#241A0F',
    coordText: '#D9C4A5',
    letter: '#F0D060',
    ghostOpacity: 0.42,
  },
  bamboo: {
    id: 'bamboo',
    nameRu: 'Бамбук',
    wood: ['#E9DCA8', '#DFD094', '#D4C381'],
    grain: '#B9A75F',
    grainOpacity: 0.3,
    line: '#4E4423',
    edgeLine: '#3D351B',
    hoshi: '#3D351B',
    coordText: '#7E7141',
    letter: '#B23A2B',
    ghostOpacity: 0.36,
  },
  paper: {
    id: 'paper',
    nameRu: 'Бумага',
    wood: ['#F6F1E6', '#F2ECDE', '#EDE6D5'],
    grain: '#E0D6C2',
    grainOpacity: 0.35,
    line: '#57503F',
    edgeLine: '#3E382B',
    hoshi: '#3E382B',
    coordText: '#8A8069',
    letter: '#B23A2B',
    ghostOpacity: 0.35,
  },
};

export const defaultBoardTheme = 'nightLuxe';
