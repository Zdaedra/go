// Хаб «Обучение» (референс-макет): крупный заголовок + чип стрика,
// капсульный сегмент-контрол (Тренировка / Дебюты / Каталог) и тёмный
// космический фон. Вкладка «Дебюты» — список дебютов по семьям,
// «Каталог» — разделы цумэго.

import React, { useMemo, useState } from 'react';
import { SectionList, Text, View, Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Rect, Circle, Defs, LinearGradient, RadialGradient, Stop } from 'react-native-svg';
import { allBranches } from '../engine/identify';
import { openingDisplayName, familyNameKeys } from '../data/names';
import TsumegoSectionsScreen from './TsumegoSectionsScreen';
import TrainingScreen from './TrainingScreen';
import MistBackground from '../components/MistBackground';
import { useTrainingProfile, streakDays } from '../state/trainingStats';
import { ui } from '../theme/uiTheme';
import { useI18n, Lang } from '../i18n';

export interface OpeningSummary {
  family: string;
  opening: string;
  name: string;
  difficulty: number | null;
  branchCount: number;
}

export function buildOpeningList(): { title: string; data: OpeningSummary[] }[] {
  const byKey = new Map<string, OpeningSummary>();
  const difficulties = new Map<string, number | null>();
  for (const b of allBranches()) {
    if (b.opening === 'preamble') continue;
    const key = `${b.family}/${b.opening}`;
    const cur = byKey.get(key);
    if (cur) {
      cur.branchCount++;
    } else {
      byKey.set(key, {
        family: b.family,
        opening: b.opening,
        name: b.opening_name,
        difficulty: difficulties.get(key) ?? null,
        branchCount: 1,
      });
    }
  }
  const families = ['tengen', 'hoshi', 'takamoku', 'territorial'];
  return families.map((fam) => ({
    title: familyNameKeys[fam] ?? fam,
    data: [...byKey.values()].filter((o) => o.family === fam),
  }));
}

// Детерминированная россыпь звёзд (стабильна между рендерами).
const STARS = (() => {
  let s = 20260711;
  const rnd = () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
  return Array.from({ length: 26 }, () => ({
    x: rnd(), y: rnd() * 0.55, r: 0.6 + rnd() * 1.1, o: 0.25 + rnd() * 0.5,
  }));
})();

/** Ночной градиент, цветные свечения и звёзды — атмосфера макета
    (консилиум: тёмно-синяя глубина + фиолетовый свет у радара + тёплый
    у CTA; звёзды мелкие и не поверх контента — карточки непрозрачные). */
function CosmosOverlay() {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Svg width="100%" height="100%">
        <Defs>
          <LinearGradient id="night" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#070B14" stopOpacity={0.94} />
            <Stop offset="0.5" stopColor="#0A0D1B" stopOpacity={0.72} />
            <Stop offset="1" stopColor="#0B1020" stopOpacity={0.45} />
          </LinearGradient>
          <RadialGradient id="glowViolet" cx="0.5" cy="0.5" r="0.5">
            <Stop offset="0" stopColor="#5A43A3" stopOpacity={0.14} />
            <Stop offset="1" stopColor="#5A43A3" stopOpacity={0} />
          </RadialGradient>
          <RadialGradient id="glowWarm" cx="0.5" cy="0.5" r="0.5">
            <Stop offset="0" stopColor="#A85F32" stopOpacity={0.12} />
            <Stop offset="1" stopColor="#A85F32" stopOpacity={0} />
          </RadialGradient>
          <RadialGradient id="glowBlue" cx="0.5" cy="0.5" r="0.5">
            <Stop offset="0" stopColor="#263A70" stopOpacity={0.18} />
            <Stop offset="1" stopColor="#263A70" stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#night)" />
        <Circle cx="18%" cy="30%" r="30%" fill="url(#glowWarm)" />
        <Circle cx="50%" cy="56%" r="42%" fill="url(#glowViolet)" />
        <Circle cx="55%" cy="96%" r="45%" fill="url(#glowBlue)" />
        {STARS.map((st, i) => (
          <Circle
            key={i}
            cx={`${st.x * 100}%`} cy={`${st.y * 100}%`} r={st.r * 0.85}
            fill={i % 5 === 0 ? '#E4B06F' : '#D9DCE5'} opacity={st.o * 0.8}
          />
        ))}
      </Svg>
    </View>
  );
}

export default function LearnScreen({ navigation }: { navigation: any }) {
  const { t } = useI18n();
  const [tab, setTab] = useState<'training' | 'openings' | 'catalog'>('training');
  const insets = useSafeAreaInsets();
  const profile = useTrainingProfile();
  const streak = streakDays(profile);

  return (
    <View style={styles.container}>
      <MistBackground />
      <CosmosOverlay />

      <View style={[styles.header, { paddingTop: insets.top + 6 }]}>
        <Text style={styles.title} maxFontSizeMultiplier={1.1}>{t('tab_learn')}</Text>
        {streak > 0 && (
          <View style={styles.streakChip}>
            <Text style={styles.streakFlame}>🔥</Text>
            <Text style={styles.streakCount} maxFontSizeMultiplier={1.1}>{streak}</Text>
          </View>
        )}
      </View>

      <View style={styles.tabsWrap}>
        {([
          ['training', t('title_training')],
          ['openings', t('tab_play')],
          ['catalog', t('tab_catalog')],
        ] as const).map(([id, label]) => (
          <Pressable
            key={id}
            onPress={() => setTab(id)}
            style={[styles.tab, tab === id && styles.tabActive]}
          >
            <Text
              style={[styles.tabText, tab === id && styles.tabTextActive]}
              maxFontSizeMultiplier={1.1}
            >
              {label}
            </Text>
          </Pressable>
        ))}
      </View>

      {tab === 'training' && <TrainingScreen navigation={navigation} />}
      {tab === 'openings' && <OpeningList navigation={navigation} />}
      {tab === 'catalog' && <TsumegoSectionsScreen navigation={navigation} />}
    </View>
  );
}

function OpeningList({ navigation }: { navigation: any }) {
  const { t, lang } = useI18n();
  const sections = useMemo(buildOpeningList, []);
  return (
    <SectionList
      sections={sections}
      keyExtractor={(item) => `${item.family}/${item.opening}`}
      contentContainerStyle={styles.list}
      renderSectionHeader={({ section }) => (
        <Text style={styles.section}>{t(section.title)}</Text>
      )}
      renderItem={({ item }) => (
        <Pressable
          style={styles.row}
          onPress={() =>
            navigation.navigate('Opening', {
              family: item.family,
              opening: item.opening,
            })
          }
        >
          <View style={styles.rowMain}>
            <Text style={styles.name}>
              {openingDisplayName(item.family, item.opening, item.name, lang)}
            </Text>
            <Text style={styles.meta}>
              {item.branchCount} {branchWord(item.branchCount, lang, t)}
            </Text>
          </View>
          <Text style={styles.chevron}>›</Text>
        </Pressable>
      )}
    />
  );
}

function branchWord(n: number, lang: Lang, t: (k: string) => string): string {
  if (lang === 'ru') {
    const mod10 = n % 10, mod100 = n % 100;
    if (mod10 === 1 && mod100 !== 11) return t('branch_one');
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return t('branch_few');
    return t('branch_many');
  }
  if (lang === 'ko') return t('branch_many');
  return n === 1 ? t('branch_one') : t('branch_many');
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingBottom: 10,
  },
  title: { fontSize: 31, fontWeight: '700', color: '#F3F1EC', letterSpacing: -0.6 },
  streakChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingVertical: 7, paddingHorizontal: 13, borderRadius: 999,
    backgroundColor: 'rgba(24,22,34,0.85)', borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  streakFlame: { fontSize: 14 },
  streakCount: { fontSize: 15, fontWeight: '700', color: ui.ink },

  tabsWrap: {
    flexDirection: 'row', marginHorizontal: 16, marginBottom: 8,
    padding: 4, borderRadius: 24,
    backgroundColor: 'rgba(16,19,30,0.88)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
  },
  tab: {
    flex: 1, paddingVertical: 8, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
  },
  tabActive: {
    backgroundColor: '#5A48C8',
    shadowColor: '#7659FF', shadowOpacity: 0.28, shadowRadius: 7,
    shadowOffset: { width: 0, height: 0 }, elevation: 3,
  },
  tabText: { fontSize: 14, fontWeight: '500', color: '#8F8E98' },
  tabTextActive: { color: '#F1EDF9', fontWeight: '600' },

  list: { paddingBottom: 32, paddingHorizontal: 16 },
  section: {
    fontSize: 12, fontWeight: '700', letterSpacing: 1.2,
    textTransform: 'uppercase', color: '#8E8B85',
    paddingTop: 18, paddingBottom: 8,
  },
  row: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 14, paddingVertical: 8, marginBottom: 8,
    backgroundColor: 'rgba(6,6,7,0.40)', borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)', borderRadius: 14,
  },
  rowMain: { flex: 1, gap: 2 },
  name: { fontSize: 19, fontFamily: 'Playfair', color: '#EFECE7' },
  meta: { fontSize: 13, color: '#8E8B85' },
  chevron: { fontSize: 22, color: '#7E7B75' },
});
