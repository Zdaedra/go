// Problem categories with their sections and progress bars.

import React from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView } from 'react-native';
import db from '../data/tsumego.json';
import { useProgress, sectionStats } from '../state/tsumegoProgress';
import { useAccess } from '../state/useTrial';
import PrimaryButton from '../components/PrimaryButton';
import { useT } from '../i18n';
import { categoryKey, sectionKey } from '../data/catalog';

// Only problems with a marked solution tree are shown to the user:
// every wrong move must get instant feedback, so unmarked positions are
// hidden until a solutions source is imported for them.
export const visibleProblems = () =>
  (db.problems as any[]).filter((p) => p.tree && p.tree.length > 0);

export default function TsumegoSectionsScreen({ navigation }: { navigation: any }) {
  const t = useT();
  const progress = useProgress();
  const access = useAccess();

  // Same hard lock as everywhere else once the free week is over.
  if (!access.open) {
    return (
      <View style={styles.lockPage}>
        <Text style={styles.lockText}>{t('tsumego_locked')}</Text>
        <PrimaryButton
          label={t('open_subscription')}
          onPress={() => navigation.getParent()?.navigate('Paywall')}
        />
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
          <Text style={styles.catTitle}>{t(categoryKey(cat.id))}</Text>
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
                  })
                }
              >
                <View style={styles.rowMain}>
                  <Text style={styles.secTitle}>{t(sectionKey(cat.id, sec.id))}</Text>
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
      <Text style={styles.note}>{t('sections_note')}</Text>
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
    paddingVertical: 10, paddingHorizontal: 14, backgroundColor: 'rgba(6,6,7,0.40)',
  },
  rowMain: { flex: 1, gap: 6 },
  secTitle: { fontSize: 18, fontFamily: 'Playfair', color: '#EFECE7' },
  barTrack: { height: 5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.08)' },
  barFill: { height: 5, borderRadius: 3, backgroundColor: '#6F63DC' },
  count: { fontSize: 13, color: '#8E8B85', fontVariant: ['tabular-nums'] },
  note: { fontSize: 12.5, color: '#8E8B85' },
  lockPage: { flex: 1, justifyContent: 'center', padding: 24, gap: 12 },
  lockText: { fontSize: 15, color: '#8E8B85', textAlign: 'center', lineHeight: 22 },
});
