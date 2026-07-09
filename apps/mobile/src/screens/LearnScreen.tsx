// Learning mode: per the spec, this is simply the list of openings as
// text, grouped by family. Tapping an opening opens its card with
// branches and board replay.

import React, { useMemo } from 'react';
import { SectionList, Text, View, Pressable, StyleSheet } from 'react-native';
import { allBranches } from '../engine/identify';
import { openingDisplayName, familyNamesRu } from '../data/names';

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
  list: { paddingBottom: 32 },
  section: {
    fontSize: 12, fontWeight: '700', letterSpacing: 1.2,
    textTransform: 'uppercase', color: '#6E6152',
    paddingHorizontal: 16, paddingTop: 18, paddingBottom: 6,
    backgroundColor: '#FBF8F1',
  },
  row: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#E0D6C2',
  },
  rowMain: { flex: 1, gap: 2 },
  name: { fontSize: 16, fontWeight: '600' },
  meta: { fontSize: 13, color: '#6E6152' },
  chevron: { fontSize: 22, color: '#8A7B65' },
});
