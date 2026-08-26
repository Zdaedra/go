// Problems of one section: numbered grid with solved marks.

import React from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView, Alert } from 'react-native';
import { useProgress } from '../state/tsumegoProgress';
import { useTrainingProfile } from '../state/trainingStats';
import { relativeLabel, abilityFor, levelLabel } from '../engine/adaptive2';
import { visibleProblems } from './TsumegoSectionsScreen';
import { useT } from '../i18n';
import { categoryKey, sectionKey } from '../data/catalog';

// #7: цвет маркера относительной сложности (5 бэндов relativeLabel).
const REL_COLOR: Record<string, string> = {
  rel_warmup: '#6FBF8E',    // легко
  rel_comfy: '#86C29A',
  rel_right: '#7E86C9',     // в самый раз
  rel_hard: '#E0A060',      // сложно
  rel_challenge: '#D06A5A', // вызов
};

// Индекс уровня из тех же порогов, что levelLabel — для предупреждения #7.
const LEVEL_BANDS = [1250, 1400, 1550, 1750, 1950];
const levelIndex = (r: number) => LEVEL_BANDS.reduce((i, b) => i + (r >= b ? 1 : 0), 0);

export default function TsumegoListScreen({ route, navigation }: { route: any; navigation: any }) {
  const { categoryId, sectionId } = route.params;
  const t = useT();
  const progress = useProgress();
  const profile = useTrainingProfile(); // #6/#7: статус повтора + сложность
  const now = Date.now();
  const problems = visibleProblems().filter(
    (p) => p.category === categoryId && p.section === sectionId
  );

  // Д11/Д12: каталог открывает единый экран эпизода (лестница + запись).
  const openProblem = (p: any, i: number) =>
    navigation.navigate('TrainingSession', {
      source: 'catalog', problemId: p.id, index: i, categoryId, sectionId,
    });

  return (
    <ScrollView contentContainerStyle={styles.page}>
      <Text style={styles.title}>{t(categoryKey(categoryId))}: {t(sectionKey(categoryId, sectionId))}</Text>
      <View style={styles.grid}>
        {problems.map((p, i) => {
          const st = progress[p.id];
          const rec = profile ? (profile.problems as any)[p.id] : null;
          const due = !!rec && rec.dueDate != null && rec.dueDate <= now; // #6
          const relKey = profile ? relativeLabel(profile, p) : null;      // #7
          const diffColor = relKey ? REL_COLOR[relKey] : null;
          return (
            <Pressable
              key={p.id}
              style={[styles.cell, st?.solved && styles.cellSolved, due && styles.cellDue]}
              onPress={() => {
                // #7: предупреждаем (не блокируем), если задача заметно выше
                // уровня — новичок иначе разобьётся о хацуёрон.
                if (profile && relKey === 'rel_challenge') {
                  const uAb = abilityFor(profile as any, p.domain || 'ld-live');
                  if (levelIndex(p.difficulty || 1498) - levelIndex(uAb) >= 2) {
                    Alert.alert(
                      t('catalog_hard_title'),
                      t('catalog_hard_body', {
                        plevel: t(levelLabel(p.difficulty || 1498)),
                        ulevel: t(levelLabel(uAb)),
                      }),
                      [
                        { text: t('catalog_hard_cancel'), style: 'cancel' },
                        { text: t('catalog_hard_go'), onPress: () => openProblem(p, i) },
                      ],
                    );
                    return;
                  }
                }
                openProblem(p, i);
              }}
            >
              {diffColor && <View style={[styles.diffDot, { backgroundColor: diffColor }]} />}
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
  cellSolved: { backgroundColor: 'rgba(139,124,246,0.12)', borderColor: '#8B7CF6' },
  // #6: пора повторить — лавандовое кольцо (ярче/толще рамки «решено»).
  cellDue: { borderColor: '#A88CFF', borderWidth: 2, backgroundColor: 'rgba(154,120,255,0.16)' },
  cellText: { fontSize: 16, fontWeight: '600', color: '#F2EFEA' },
  cellTextSolved: { color: '#C5BBF0' },
  check: { position: 'absolute', top: 2, right: 5, fontSize: 10, color: '#C5BBF0' },
  // #7: маркер относительной сложности (цвет по бэнду relativeLabel).
  diffDot: { position: 'absolute', top: 5, left: 5, width: 7, height: 7, borderRadius: 4 },
});
