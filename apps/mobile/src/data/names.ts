// Opening display names. The author's English names from the source
// database are replaced by ORIGINAL Russian names — each evokes the stone
// shape but shares no semantic root with the book's name (generated
// 2026-07-10, gpt-5.5, with the English names as an explicit blocklist).
// Rename here — and only here.

const overrides: Record<string, string> = {
  'hoshi/airship': 'Дальняя свеча',
  'hoshi/bean-throwing': 'Ломаная лестница',
  'hoshi/big-flower': 'Тесный двор',
  'hoshi/black-boomerang': 'Горный уступ',
  'hoshi/blackjack': 'Камертон',
  'hoshi/flower': 'Лисий капкан',
  'hoshi/horse-head': 'Парные сваи',
  'hoshi/lunar-eclipse': 'Косой дождь',
  'hoshi/other-hoshi-openings': 'Квадратный спор',
  'hoshi/submarine': 'Рваный край',
  'hoshi/swing': 'Лесная тропа',
  'takamoku/andromeda': 'Зеркальный вал',
  'takamoku/boots': 'Сломанный карниз',
  'takamoku/jump-attachment': 'Тесный порог',
  'takamoku/kodachi': 'Крабья клешня',
  'takamoku/new-orthodox': 'Горный зуб',
  'takamoku/other-takamoku-openings': 'Серый лабиринт',
  'takamoku/secret-agent-033': 'Дальний крючок',
  'takamoku/slider': 'Косой уступ',
  'takamoku/white-slice': 'Каменная плотина',
  'takamoku/zazen': 'Две колонны',
  'tengen/almost-equilateral-1': 'Клюв',
  'tengen/almost-equilateral-2': 'Клещи',
  'tengen/almost-equilateral-3': 'Ковш',
  'tengen/cross-line': 'Компас',
  'tengen/curveball': 'Косогор',
  'tengen/hand-fan': 'Скоба',
  'tengen/headbutt': 'Пробка',
  'tengen/jump-attack': 'Застава',
  'tengen/orthodox': 'Уголёк',
  'tengen/other-tengen-openings': 'Навес',
  'tengen/pendulum': 'Ступени',
  'tengen/side-attachment': 'Засов',
  'tengen/soccer-juggling': 'Тренога',
  'tengen/sword': 'Перешеек',
  'tengen/windmill': 'Лабиринт',
  'territorial/avoiding-transpositions': 'Дальние колышки',
  'territorial/komoku': 'Косой порог',
  'territorial/mokuhazushi': 'Каменный уступ',
  'territorial/mokuhazushi-main-line': 'Ломаный карниз',
  'territorial/other-mokuhazushi-openings': 'Пятнистая карта',
  'territorial/sansan': 'Угловая нора',
  'territorial/sea-fairy': 'Крепкий зажим',
};

export function openingDisplayName(family: string, opening: string, dbName: string): string {
  return overrides[`${family}/${opening}`] ?? dbName;
}

export const familyNamesRu: Record<string, string> = {
  tengen: 'Тэнгэн',
  hoshi: 'Хоси',
  takamoku: 'Такамоку',
  territorial: 'Территориальные',
};
