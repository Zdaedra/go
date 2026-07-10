// Training dashboard: overall status, per-skill strength bars and the
// Play button that starts an adaptive session.

import React from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView } from 'react-native';
import {
  useTrainingProfile, domainStats, trainingPool,
} from '../state/trainingStats';
import { levelLabel } from '../engine/adaptive';
import { useAccess } from '../state/useTrial';

const BAR_MIN = 800;
const BAR_MAX = 2200;

export default function TrainingScreen({ navigation }: { navigation: any }) {
  const profile = useTrainingProfile();
  const access = useAccess();

  if (!access.open) {
    return (
      <View style={styles.lockPage}>
        <Text style={styles.lockText}>
          Бесплатная неделя закончилась. Подписка откроет тренировку и задачи.
        </Text>
        <Pressable
          style={styles.playBtn}
          onPress={() => navigation.getParent()?.navigate('Paywall')}
        >
          <Text style={styles.playText}>Открыть подписку</Text>
        </Pressable>
      </View>
    );
  }

  if (!profile) return null;

  const stats = domainStats(profile);
  const attempts = profile.solved + profile.failed;
  const accuracy = attempts ? Math.round((profile.solved / attempts) * 100) : null;
  const avgRating = stats.length
    ? Math.round(stats.reduce((s, d) => s + d.rating, 0) / stats.length)
    : 1100;
  const weakest = stats[0];

  return (
    <ScrollView contentContainerStyle={styles.page}>
      <View style={styles.header}>
        <View style={styles.headerCell}>
          <Text style={styles.big}>{profile.points}</Text>
          <Text style={styles.small}>очков</Text>
        </View>
        <View style={styles.headerCell}>
          <Text style={styles.big}>{profile.solved}</Text>
          <Text style={styles.small}>решено</Text>
        </View>
        <View style={styles.headerCell}>
          <Text style={styles.big}>{accuracy != null ? `${accuracy}%` : '—'}</Text>
          <Text style={styles.small}>точность</Text>
        </View>
        <View style={styles.headerCell}>
          <Text style={styles.big}>{avgRating}</Text>
          <Text style={styles.small}>{levelLabel(avgRating)}</Text>
        </View>
      </View>

      <Pressable
        style={styles.playBtn}
        onPress={() => navigation.navigate('TrainingSession')}
      >
        <Text style={styles.playText}>▶ Играть</Text>
      </Pressable>
      <Text style={styles.playNote}>
        Тренажёр сам подбирает задачи: держит сложность в твоей зоне роста,
        чередует навыки и возвращает ошибки для повторения.
      </Text>

      <Text style={styles.section}>Навыки</Text>
      {stats.map((d) => {
        const frac = Math.max(0, Math.min(1, (d.rating - BAR_MIN) / (BAR_MAX - BAR_MIN)));
        return (
          <View key={d.domain} style={styles.domainRow}>
            <View style={styles.domainHead}>
              <Text style={styles.domainName}>
                {d.label}
                {d === weakest && stats.length > 1 ? '  · слабое место' : ''}
              </Text>
              <Text style={styles.domainMeta}>
                {d.rating} · {d.level} · {d.solved}/{d.total}
              </Text>
            </View>
            <View style={styles.barTrack}>
              <View style={[styles.barFill, { width: `${frac * 100}%` },
                d === weakest && stats.length > 1 && styles.barWeak]} />
            </View>
          </View>
        );
      })}

      <Text style={styles.poolNote}>
        В тренировке {trainingPool().length} проверяемых задач; база растёт
        по мере разметки решений.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { padding: 16, gap: 12, paddingBottom: 40 },
  header: { flexDirection: 'row', gap: 8 },
  headerCell: {
    flex: 1, alignItems: 'center', paddingVertical: 10,
    backgroundColor: 'rgba(6,6,7,0.66)', borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)', borderRadius: 12,
  },
  big: { fontSize: 22, fontFamily: 'Playfair', fontVariant: ['tabular-nums'], color: '#F2EFEA' },
  small: { fontSize: 12, color: '#8E8B85' },
  playBtn: {
    borderRadius: 12, paddingVertical: 16, alignItems: 'center', marginTop: 6,
    backgroundColor: '#1A1720', borderWidth: 1.5, borderColor: '#7C6EE0',
    shadowColor: '#7C6EE0', shadowOpacity: 0.28, shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 }, elevation: 5,
  },
  playText: { color: '#FFFFFF', fontSize: 18, fontWeight: '800' },
  playNote: { fontSize: 13, color: '#8E8B85', textAlign: 'center' },
  section: {
    fontSize: 12, fontWeight: '700', letterSpacing: 1.2,
    textTransform: 'uppercase', color: '#8E8B85', marginTop: 10,
  },
  domainRow: {
    gap: 7, backgroundColor: 'rgba(6,6,7,0.66)', borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)', borderRadius: 12,
    paddingVertical: 12, paddingHorizontal: 14,
  },
  domainHead: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  domainName: { fontSize: 15, fontWeight: '600', flexShrink: 1, color: '#F2EFEA' },
  domainMeta: { fontSize: 12.5, color: '#8E8B85', fontVariant: ['tabular-nums'] },
  barTrack: { height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.08)' },
  barFill: { height: 4, borderRadius: 2, backgroundColor: '#6F63DC' },
  barWeak: { backgroundColor: '#F0A878' },
  poolNote: { fontSize: 12.5, color: '#8E8B85', marginTop: 8 },
  lockPage: { flex: 1, justifyContent: 'center', padding: 24, gap: 12 },
  lockText: { fontSize: 15, color: '#8E8B85', textAlign: 'center', lineHeight: 22 },
});
