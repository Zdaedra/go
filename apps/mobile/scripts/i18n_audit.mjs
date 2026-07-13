#!/usr/bin/env node
// Аудит i18n (ТЗ docs/tz-i18n-v1.md): проценты покрытия по локалям и слоям,
// детект нового хардкода (кириллица в коде вне словарей), blocklist-проверка
// названий дебютов. Ненулевой exit code = нарушение — годится для CI.
//
// Запуск: node scripts/i18n_audit.mjs   (из apps/mobile)

import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';

const ROOT = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'src');
const LOCALES = ['ru', 'en', 'es', 'fr', 'de', 'ko'];
let failed = false;

const pct = (n, d) => (d ? Math.round((1000 * n) / d) / 10 : 100);

// ---------- Слой A: strings.json ----------
const strings = JSON.parse(fs.readFileSync(path.join(SRC, 'i18n/strings.json'), 'utf8'));
const keys = Object.keys(strings);
console.log(`Слой A — strings.json: ${keys.length} ключей`);
for (const loc of LOCALES) {
  const n = keys.filter((k) => (strings[k][loc] ?? '').trim()).length;
  const p = pct(n, keys.length);
  console.log(`  ${loc}: ${n}/${keys.length} = ${p}%`);
  if (p < 100) { failed = true; console.log(`  !! слой A должен быть 100% (${loc})`); }
}

// ---------- Слой B: названия дебютов (data/names.ts) ----------
const namesTs = fs.readFileSync(path.join(SRC, 'data/names.ts'), 'utf8');
const entryRe = /'([\w-]+\/[\w-]+)':\s*\{([^}]*)\}/g;
let m, openings = 0, openingsFull = 0;
const enNames = [];
while ((m = entryRe.exec(namesTs))) {
  openings++;
  const body = m[2];
  const have = LOCALES.filter((l) => new RegExp(`\\b${l}: '`).test(body));
  if (have.length === LOCALES.length) openingsFull++;
  const en = body.match(/\ben: '((?:[^'\\]|\\.)*)'/);
  if (en) enNames.push(en[1].replace(/\\'/g, "'"));
}
console.log(`Слой B — названия дебютов: ${openingsFull}/${openings} полных (все 6 локалей)`);
if (openingsFull < openings) { failed = true; console.log('  !! не все имена переведены'); }

// Blocklist: en-имена не должны совпадать с книжными
const branches = JSON.parse(fs.readFileSync(path.join(SRC, 'data/branches.json'), 'utf8'));
const book = new Set(branches.branches.map((b) => (b.opening_name || '').trim().toLowerCase()).filter(Boolean));
const clash = enNames.filter((n) => book.has(n.trim().toLowerCase()));
if (clash.length) { failed = true; console.log(`  !! en-имена совпали с книжными: ${clash.join(', ')}`); }
else console.log(`  blocklist: 0 совпадений с ${book.size} книжными именами`);

// ---------- Слой C: hintTemplates + контентные данные ----------
const hints = JSON.parse(fs.readFileSync(path.join(SRC, 'data/hintTemplates.json'), 'utf8'));
let hintTexts = 0, hintFull = 0;
const eachText = (v) => {
  hintTexts++;
  if (typeof v === 'object' && LOCALES.every((l) => (v[l] ?? '').trim())) hintFull++;
};
for (const tpl of Object.values(hints.domains)) {
  tpl.h0.forEach((x) => eachText(x.text));
  eachText(tpl.h1Fallback);
  tpl.h2.forEach((x) => eachText(x.text));
  tpl.h4Reason.forEach(eachText);
  eachText(tpl.h4RefutePrefix);
}
console.log(`Слой C — hintTemplates: ${hintFull}/${hintTexts} текстов на всех 6 локалях`);
if (hintFull < hintTexts) { failed = true; console.log('  !! шаблоны подсказок не полностью переведены'); }

const desc = JSON.parse(fs.readFileSync(path.join(SRC, 'data/descriptions.json'), 'utf8'));
const descEntries = Object.entries(desc);
const DESC_LANGS = ['ru', 'en', 'es', 'fr', 'de', 'ko'];
// Вложенный формат {branch_id: {ru,en,...}} (волна 2). Полностью локализовано,
// если у ветки все 6 локалей непустые.
const descFull = descEntries.filter(([, v]) =>
  v && typeof v === 'object' && DESC_LANGS.every((L) => (v[L] || '').trim())).length;
console.log(`Слой C — descriptions.json: ${descFull}/${descEntries.length} описаний веток на всех 6 локалях`);
if (descFull < descEntries.length) { failed = true; console.log('  !! описания дебютов переведены не полностью'); }

const tsumego = JSON.parse(fs.readFileSync(path.join(SRC, 'data/tsumego.json'), 'utf8'));
const cyrTitles = tsumego.problems.filter((p) => /[А-Яа-яЁё]/.test(p.title || '')).length;
console.log(`Слой C — заголовки задач: ${cyrTitles}/${tsumego.problems.length} кириллических (вне ru скрываются) — волна 2`);

// ---------- Хардкод: кириллица в коде вне словарей ----------
// index.tsx: эндонимы языков (Русский/English/한국어) показываются как есть
const ALLOW = new Set(['i18n/strings.json', 'i18n/index.tsx']);
const offenders = [];
const walk = (dir) => {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { walk(p); continue; }
    if (!/\.(ts|tsx|js)$/.test(e.name)) continue;
    const rel = path.relative(SRC, p);
    if (ALLOW.has(rel) || rel === 'data/names.ts') continue;
    let code = fs.readFileSync(p, 'utf8');
    // вычёркиваем комментарии — кириллица в них допустима
    code = code.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
    const lines = code.split('\n');
    lines.forEach((line, i) => {
      if (line.includes('А-Яа-яЁё]')) return; // regex-класс кириллицы, не текст
      if (/[А-Яа-яЁё]/.test(line)) offenders.push(`${rel}:${i + 1}: ${line.trim().slice(0, 80)}`);
    });
  }
};
walk(SRC);
if (offenders.length) {
  failed = true;
  console.log(`\n!! Хардкод-кириллица в коде (${offenders.length}):`);
  offenders.slice(0, 30).forEach((o) => console.log('  ' + o));
} else {
  console.log('\nХардкод в коде: 0 строк кириллицы вне словарей ✓');
}

console.log(failed ? '\nАУДИТ: FAIL' : '\nАУДИТ: OK');
process.exit(failed ? 1 : 0);
