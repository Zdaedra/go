// Opening display names. The author's English names from the source
// database are replaced by original Russian names (generated 2026-07-10,
// gpt-5.5 pass over the factual move data). Rename here — and only here.

const overrides: Record<string, string> = {
  'hoshi/airship': 'Крыло',
  'hoshi/bean-throwing': 'Россыпь',
  'hoshi/big-flower': 'Подсолнух',
  'hoshi/black-boomerang': 'Чёрный серп',
  'hoshi/blackjack': 'Клинок',
  'hoshi/flower': 'Клевер',
  'hoshi/horse-head': 'Грива',
  'hoshi/lunar-eclipse': 'Тёмный край',
  'hoshi/other-hoshi-openings': 'Развилка',
  'hoshi/submarine': 'Нырок',
  'hoshi/swing': 'Перевал',
  'takamoku/andromeda': 'Звёздный крюк',
  'takamoku/boots': 'Тяжёлый шаг',
  'takamoku/jump-attachment': 'Крючок влёт',
  'takamoku/kodachi': 'Короткий зуб',
  'takamoku/new-orthodox': 'Косой щит',
  'takamoku/other-takamoku-openings': 'Дикий холм',
  'takamoku/secret-agent-033': 'Тихий укол',
  'takamoku/slider': 'Скользкий клин',
  'takamoku/white-slice': 'Серебряный разрез',
  'takamoku/zazen': 'Тихий обруч',
  'tengen/almost-equilateral-1': 'Ломаный треугольник',
  'tengen/almost-equilateral-2': 'Рваный треугольник',
  'tengen/almost-equilateral-3': 'Косой трезубец',
  'tengen/cross-line': 'Косой крест',
  'tengen/curveball': 'Змеиный крюк',
  'tengen/hand-fan': 'Крыло цапли',
  'tengen/headbutt': 'Жёсткий таран',
  'tengen/jump-attack': 'Тигриный скачок',
  'tengen/orthodox': 'Северный клин',
  'tengen/other-tengen-openings': 'Дикий тэнгэн',
  'tengen/pendulum': 'Качели центра',
  'tengen/side-attachment': 'Прилипший бок',
  'tengen/soccer-juggling': 'Скачущий узел',
  'tengen/sword': 'Стальная дуга',
  'tengen/windmill': 'Вихревой крест',
  'territorial/avoiding-transpositions': 'Боковой увод',
  'territorial/komoku': 'Угловой зуб',
  'territorial/mokuhazushi': 'Косой крюк',
  'territorial/mokuhazushi-main-line': 'Центральный клин',
  'territorial/other-mokuhazushi-openings': 'Ломаный берег',
  'territorial/sansan': 'Тихая нора',
  'territorial/sea-fairy': 'Пенная сеть',
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
