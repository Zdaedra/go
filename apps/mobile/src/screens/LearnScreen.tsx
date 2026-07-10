// Learning mode: per the spec, this is simply the list of openings as
// text, grouped by family. Tapping an opening opens its card with
// branches and board replay.

import React, { useMemo, useState } from 'react';
import { SectionList, Text, View, Pressable, StyleSheet } from 'react-native';
import { allBranches } from '../engine/identify';
import { openingDisplayName, familyNamesRu } from '../data/names';
import TsumegoSectionsScreen from './TsumegoSectionsScreen';
import TrainingScreen from './TrainingScreen';

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
    title: familyNamesRu[fam] ?? fam,
    data: [...byKey.values()].filter((o) => o.family === fam),
  }));
}

export default function LearnScreen({ navigation }: { navigation: any }) {
  const [tab, setTab] = useState<'training' | 'openings' | 'catalog'>('training');
  return (
    <View style={styles.container}>
      <View style={styles.tabs}>
        {([
          ['training', 'Тренировка'],
          ['openings', 'Дебюты'],
          ['catalog', 'Каталог'],
        ] as const).map(([id, label]) => (
          <Pressable
            key={id}
            onPress={() => setTab(id)}
            style={[styles.tab, tab === id && styles.tabActive]}
          >
            <Text style={[styles.tabText, tab === id && styles.tabTextActive]}>
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
  const sections = useMemo(buildOpeningList, []);
  return (
    <SectionList
      sections={sections}
      keyExtractor={(item) => `${item.family}/${item.opening}`}
      contentContainerStyle={styles.list}
      renderSectionHeader={({ section }) => (
        <Text style={styles.section}>{section.title}</Text>
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
              {openingDisplayName(item.family, item.opening, item.name)}
            </Text>
            <Text style={styles.meta}>
              {item.branchCount} {branchWord(item.branchCount)}
            </Text>
          </View>
          <Text style={styles.chevron}>›</Text>
        </Pressable>
      )}
    />
  );
}

function branchWord(n: number): string {
  const mod10 = n % 10, mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return 'ветка';
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'ветки';
  return 'веток';
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  tabs: {
    flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingVertical: 10,
    backgroundColor: '#100E0D',
  },
  tab: {
    paddingVertical: 6, paddingHorizontal: 16, borderRadius: 999,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)',
  },
  tabActive: { backgroundColor: '#8B7CF6', borderColor: '#8B7CF6' },
  tabText: { fontSize: 14, fontWeight: '600', color: '#F2EFEA' },
  tabTextActive: { color: '#FFFFFF' },
  list: { paddingBottom: 32 },
  section: {
    fontSize: 12, fontWeight: '700', letterSpacing: 1.2,
    textTransform: 'uppercase', color: '#8E8B85',
    paddingHorizontal: 16, paddingTop: 18, paddingBottom: 6,
    backgroundColor: '#100E0D',
  },
  row: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  rowMain: { flex: 1, gap: 2 },
  name: { fontSize: 16, fontWeight: '600', color: '#F2EFEA' },
  meta: { fontSize: 13, color: '#8E8B85' },
  chevron: { fontSize: 22, color: '#7E7B75' },
});
