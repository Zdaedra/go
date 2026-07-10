// Problems of one section: numbered grid with solved marks.

import React from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView } from 'react-native';
import { useProgress } from '../state/tsumegoProgress';
import { visibleProblems } from './TsumegoSectionsScreen';

export default function TsumegoListScreen({ route, navigation }: { route: any; navigation: any }) {
  const { categoryId, sectionId, title } = route.params;
  const progress = useProgress();
  const problems = visibleProblems().filter(
    (p) => p.category === categoryId && p.section === sectionId
  );

  return (
    <ScrollView contentContainerStyle={styles.page}>
      <Text style={styles.title}>{title}</Text>
      <View style={styles.grid}>
        {problems.map((p, i) => {
          const st = progress[p.id];
          return (
            <Pressable
              key={p.id}
              style={[styles.cell, st?.solved && styles.cellSolved]}
              onPress={() =>
                navigation.navigate('TsumegoProblem', {
                  problemId: p.id,
                  index: i,
                  categoryId,
                  sectionId,
                  title,
                })
              }
            >
              <Text style={[styles.cellText, st?.solved && styles.cellTextSolved]}>
                {i + 1}
              </Text>
              {st?.solved && <Text style={styles.check}>✓</Text>}
            </Pressable>
          );
        })}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { padding: 16, gap: 14 },
  title: { fontSize: 21, fontWeight: '500', color: '#EFECE7', fontFamily: 'Playfair' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  cell: {
    width: 52, height: 52, borderRadius: 10,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)',
    alignItems: 'center', justifyContent: 'center',
  },
  cellSolved: { backgroundColor: '#22301C', borderColor: '#7B9464' },
  cellText: { fontSize: 16, fontWeight: '600', color: '#F2EFEA' },
  cellTextSolved: { color: '#A9C48F' },
  check: { position: 'absolute', top: 2, right: 5, fontSize: 10, color: '#A9C48F' },
});
