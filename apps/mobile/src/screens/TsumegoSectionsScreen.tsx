// Problem categories with their sections and progress bars.

import React from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView } from 'react-native';
import db from '../data/tsumego.json';
import { useProgress, sectionStats } from '../state/tsumegoProgress';
import { useAccess } from '../state/useTrial';

// Only problems with a marked solution tree are shown to the user:
// every wrong move must get instant feedback, so unmarked positions are
// hidden until a solutions source is imported for them.
export const visibleProblems = () =>
  (db.problems as any[]).filter((p) => p.tree && p.tree.length > 0);

export default function TsumegoSectionsScreen({ navigation }: { navigation: any }) {
  const progress = useProgress();
  const access = useAccess();

  // Same hard lock as everywhere else once the free week is over.
  if (!access.open) {
    return (
      <View style={styles.lockPage}>
        <Text style={styles.lockText}>
          Бесплатная неделя закончилась. Подписка откроет задачи и все дебюты.
        </Text>
        <Pressable
          style={styles.lockBtn}
          onPress={() => navigation.getParent()?.navigate('Paywall')}
        >
          <Text style={styles.lockBtnText}>Открыть подписку</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.page}>
      {(db.categories as any[]).map((cat) => {
        const catProblems = visibleProblems().filter((p) => p.category === cat.id);
        if (catProblems.length === 0) return null;
        return (
        <View key={cat.id} style={styles.category}>
          <Text style={styles.catTitle}>{cat.title}</Text>
          {cat.sections.map((sec: any) => {
            const ids = catProblems
              .filter((p) => p.section === sec.id)
              .map((p) => p.id);
            if (ids.length === 0) return null;
            const { solved, total } = sectionStats(progress, ids);
            return (
              <Pressable
                key={sec.id}
                style={styles.row}
                onPress={() =>
                  navigation.navigate('TsumegoList', {
                    categoryId: cat.id,
                    sectionId: sec.id,
                    title: `${cat.title}: ${sec.title}`,
                  })
                }
              >
                <View style={styles.rowMain}>
                  <Text style={styles.secTitle}>{sec.title}</Text>
                  <View style={styles.barTrack}>
                    <View
                      style={[
                        styles.barFill,
                        { width: `${total ? (solved / total) * 100 : 0}%` },
                      ]}
                    />
                  </View>
                </View>
                <Text style={styles.count}>
                  {solved}/{total}
                </Text>
              </Pressable>
            );
          })}
        </View>
        );
      })}
      <Text style={styles.note}>
        Стартовый набор — классические учебные формы. Большие классические
        сборники подключаются импортом SGF (scripts/import_tsumego_sgf.py).
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { padding: 16, gap: 18, paddingBottom: 40 },
  category: { gap: 8 },
  catTitle: {
    fontSize: 12, fontWeight: '700', letterSpacing: 1.2,
    textTransform: 'uppercase', color: '#8E8B85',
  },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', borderRadius: 10,
    paddingVertical: 10, paddingHorizontal: 14, backgroundColor: '#171412',
  },
  rowMain: { flex: 1, gap: 6 },
  secTitle: { fontSize: 16, fontWeight: '600', color: '#F2EFEA' },
  barTrack: { height: 5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.08)' },
  barFill: { height: 5, borderRadius: 3, backgroundColor: '#7B9464' },
  count: { fontSize: 13, color: '#8E8B85', fontVariant: ['tabular-nums'] },
  note: { fontSize: 12.5, color: '#8E8B85' },
  lockPage: { flex: 1, justifyContent: 'center', padding: 24, gap: 12 },
  lockText: { fontSize: 15, color: '#8E8B85', textAlign: 'center', lineHeight: 22 },
  lockBtn: {
    backgroundColor: '#8B7CF6', borderRadius: 10, paddingVertical: 12,
    alignItems: 'center',
  },
  lockBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
});
