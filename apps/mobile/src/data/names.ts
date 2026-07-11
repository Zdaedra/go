// Opening display names, ORIGINAL in every language (the book's English
// names are an explicit blocklist — checked by scripts/i18n_audit.mjs).
// Each name evokes the stone shape; translations render OUR images, not
// the book's. Rename here — and only here. (ru set generated 2026-07-10,
// gpt-5.5; en/es/fr/de/ko added 2026-07-11.)

import type { Lang } from '../i18n';

const overrides: Record<string, Record<Lang, string>> = {
  'hoshi/airship': { ru: 'Дальняя свеча', en: 'Distant Candle', es: 'Vela lejana', fr: 'Chandelle lointaine', de: 'Ferne Kerze', ko: '먼 촛불' },
  'hoshi/bean-throwing': { ru: 'Ломаная лестница', en: 'Broken Stairs', es: 'Escalera rota', fr: 'Escalier brisé', de: 'Zerbrochene Treppe', ko: '부러진 계단' },
  'hoshi/big-flower': { ru: 'Тесный двор', en: 'Cramped Courtyard', es: 'Patio estrecho', fr: 'Cour étroite', de: 'Enger Hof', ko: '비좁은 마당' },
  'hoshi/black-boomerang': { ru: 'Горный уступ', en: 'Mountain Ledge', es: 'Cornisa montañosa', fr: 'Corniche de montagne', de: 'Bergvorsprung', ko: '산 벼랑턱' },
  'hoshi/blackjack': { ru: 'Камертон', en: 'Tuning Fork', es: 'Diapasón', fr: 'Diapason', de: 'Stimmgabel', ko: '소리굽쇠' },
  'hoshi/flower': { ru: 'Лисий капкан', en: 'Fox Trap', es: 'Trampa de zorro', fr: 'Piège à renard', de: 'Fuchsfalle', ko: '여우 덫' },
  'hoshi/horse-head': { ru: 'Парные сваи', en: 'Twin Stilts', es: 'Pilotes gemelos', fr: 'Pilotis jumeaux', de: 'Zwillingspfähle', ko: '쌍말뚝' },
  'hoshi/lunar-eclipse': { ru: 'Косой дождь', en: 'Slanting Rain', es: 'Lluvia oblicua', fr: 'Pluie oblique', de: 'Schräger Regen', ko: '비스듬한 비' },
  'hoshi/other-hoshi-openings': { ru: 'Квадратный спор', en: 'Square Dispute', es: 'Disputa cuadrada', fr: 'Querelle carrée', de: 'Quadratstreit', ko: '네모 다툼' },
  'hoshi/submarine': { ru: 'Рваный край', en: 'Ragged Edge', es: 'Borde rasgado', fr: 'Bord déchiré', de: 'Ausgefranster Rand', ko: '찢긴 가장자리' },
  'hoshi/swing': { ru: 'Лесная тропа', en: 'Forest Path', es: 'Senda del bosque', fr: 'Sentier forestier', de: 'Waldpfad', ko: '숲길' },
  'takamoku/andromeda': { ru: 'Зеркальный вал', en: 'Mirror Rampart', es: 'Muralla espejada', fr: 'Rempart miroir', de: 'Spiegelwall', ko: '거울 성벽' },
  'takamoku/boots': { ru: 'Сломанный карниз', en: 'Broken Cornice', es: 'Cornisa rota', fr: 'Corniche brisée', de: 'Gebrochenes Gesims', ko: '부서진 처마' },
  'takamoku/jump-attachment': { ru: 'Тесный порог', en: 'Narrow Doorstep', es: 'Umbral estrecho', fr: 'Seuil étroit', de: 'Enge Schwelle', ko: '좁은 문턱' },
  'takamoku/kodachi': { ru: 'Крабья клешня', en: 'Crab Claw', es: 'Pinza de cangrejo', fr: 'Pince de crabe', de: 'Krebsschere', ko: '게 집게발' },
  'takamoku/new-orthodox': { ru: 'Горный зуб', en: 'Mountain Tooth', es: 'Diente de montaña', fr: 'Dent de montagne', de: 'Bergzahn', ko: '산 이빨' },
  'takamoku/other-takamoku-openings': { ru: 'Серый лабиринт', en: 'Grey Maze', es: 'Laberinto gris', fr: 'Labyrinthe gris', de: 'Graues Labyrinth', ko: '잿빛 미로' },
  'takamoku/secret-agent-033': { ru: 'Дальний крючок', en: 'Distant Hook', es: 'Anzuelo lejano', fr: 'Hameçon lointain', de: 'Ferner Haken', ko: '먼 낚싯바늘' },
  'takamoku/slider': { ru: 'Косой уступ', en: 'Slanted Ledge', es: 'Saliente oblicuo', fr: 'Gradin oblique', de: 'Schräger Absatz', ko: '비스듬한 턱' },
  'takamoku/white-slice': { ru: 'Каменная плотина', en: 'Stone Dam', es: 'Presa de piedra', fr: 'Barrage de pierre', de: 'Steindamm', ko: '돌둑' },
  'takamoku/zazen': { ru: 'Две колонны', en: 'Two Columns', es: 'Dos columnas', fr: 'Deux colonnes', de: 'Zwei Säulen', ko: '두 기둥' },
  'tengen/almost-equilateral-1': { ru: 'Клюв', en: 'Beak', es: 'Pico', fr: 'Bec', de: 'Schnabel', ko: '부리' },
  'tengen/almost-equilateral-2': { ru: 'Клещи', en: 'Pincers', es: 'Tenazas', fr: 'Tenailles', de: 'Zange', ko: '집게' },
  'tengen/almost-equilateral-3': { ru: 'Ковш', en: 'Ladle', es: 'Cazo', fr: 'Louche', de: 'Kelle', ko: '국자' },
  'tengen/cross-line': { ru: 'Компас', en: 'Compass', es: 'Brújula', fr: 'Boussole', de: 'Kompass', ko: '나침반' },
  'tengen/curveball': { ru: 'Косогор', en: 'Hillside', es: 'Ladera', fr: 'Coteau', de: 'Berghang', ko: '산비탈' },
  'tengen/hand-fan': { ru: 'Скоба', en: 'Staple', es: 'Grapa', fr: 'Agrafe', de: 'Krampe', ko: '꺾쇠' },
  'tengen/headbutt': { ru: 'Пробка', en: 'Stopper', es: 'Tapón', fr: 'Bouchon', de: 'Stöpsel', ko: '마개' },
  'tengen/jump-attack': { ru: 'Застава', en: 'Outpost', es: 'Avanzada', fr: 'Avant-poste', de: 'Vorposten', ko: '전초 기지' },
  'tengen/orthodox': { ru: 'Уголёк', en: 'Ember', es: 'Brasa', fr: 'Braise', de: 'Glutfunke', ko: '불씨' },
  'tengen/other-tengen-openings': { ru: 'Навес', en: 'Canopy', es: 'Toldo', fr: 'Auvent', de: 'Vordach', ko: '차양' },
  'tengen/pendulum': { ru: 'Ступени', en: 'Steps', es: 'Peldaños', fr: 'Marches', de: 'Stufen', ko: '층계' },
  'tengen/side-attachment': { ru: 'Засов', en: 'Door Bolt', es: 'Cerrojo', fr: 'Verrou', de: 'Riegel', ko: '빗장' },
  'tengen/soccer-juggling': { ru: 'Тренога', en: 'Tripod', es: 'Trípode', fr: 'Trépied', de: 'Dreibein', ko: '삼각대' },
  'tengen/sword': { ru: 'Перешеек', en: 'Isthmus', es: 'Istmo', fr: 'Isthme', de: 'Landenge', ko: '지협' },
  'tengen/windmill': { ru: 'Лабиринт', en: 'Maze', es: 'Laberinto', fr: 'Labyrinthe', de: 'Labyrinth', ko: '미로' },
  'territorial/avoiding-transpositions': { ru: 'Дальние колышки', en: 'Distant Pegs', es: 'Estacas lejanas', fr: 'Piquets lointains', de: 'Ferne Pflöcke', ko: '먼 말뚝들' },
  'territorial/komoku': { ru: 'Косой порог', en: 'Slanted Threshold', es: 'Umbral oblicuo', fr: 'Seuil oblique', de: 'Schräge Schwelle', ko: '비스듬한 문턱' },
  'territorial/mokuhazushi': { ru: 'Каменный уступ', en: 'Stone Ledge', es: 'Saliente de piedra', fr: 'Corniche de pierre', de: 'Steinvorsprung', ko: '돌 벼랑턱' },
  'territorial/mokuhazushi-main-line': { ru: 'Ломаный карниз', en: 'Jagged Cornice', es: 'Cornisa quebrada', fr: 'Corniche dentelée', de: 'Zackiges Gesims', ko: '들쭉날쭉한 처마' },
  'territorial/other-mokuhazushi-openings': { ru: 'Пятнистая карта', en: 'Spotted Map', es: 'Mapa moteado', fr: 'Carte tachetée', de: 'Gefleckte Karte', ko: '얼룩진 지도' },
  'territorial/sansan': { ru: 'Угловая нора', en: 'Corner Burrow', es: 'Madriguera de esquina', fr: 'Terrier du coin', de: 'Eckhöhle', ko: '귀의 굴' },
  'territorial/sea-fairy': { ru: 'Крепкий зажим', en: 'Tight Grip', es: 'Agarre firme', fr: 'Prise ferme', de: 'Fester Griff', ko: '단단한 조임' },
};

export function openingDisplayName(
  family: string, opening: string, dbName: string, lang: Lang = 'ru'
): string {
  const o = overrides[`${family}/${opening}`];
  return o ? (o[lang] ?? o.en) : dbName;
}

// Семьи дебютов — i18n-ключи (переводы в strings.json).
export const familyNameKeys: Record<string, string> = {
  tengen: 'family_tengen',
  hoshi: 'family_hoshi',
  takamoku: 'family_takamoku',
  territorial: 'family_territorial',
};
