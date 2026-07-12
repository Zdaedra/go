// Дашборд тренировки по референс-макету «Обучение»: карточка статов,
// CTA «Играть», звезда навыков (радар по доменам) и лента прогресса.
// После консилиума v2: плотнее вертикальная композиция, тёмная play-кнопка
// с оранжевым кольцом, спокойная типографика, синеватые поверхности.

import React, { useMemo } from 'react';
import {
  View, Text, Pressable, StyleSheet, ScrollView, Alert, Dimensions,
} from 'react-native';
import Svg, { Circle, Defs, RadialGradient, Stop, Path } from 'react-native-svg';
import {
  useTrainingProfile, domainStats, trainingPool, levelLabel, dueReviewCount,
  todayProgress, DAILY_GOAL, markSrsExplained,
} from '../state/trainingStats';
import { useAccess } from '../state/useTrial';
import PrimaryButton from '../components/PrimaryButton';
import SkillRadar, { RadarAxis } from '../components/SkillRadar';
import DomainIcon, { DOMAIN_COLORS } from '../components/DomainIcon';
import { ui } from '../theme/uiTheme';
import { useT } from '../i18n';

// Порядок осей звезды — как на макете: сверху по часовой.
const RADAR_ORDER = ['capture', 'ld-live', 'ld-kill', 'ko', 'race', 'connect'];

// Локальные токены экрана (консилиум: единая холодная тёмно-синяя палитра).
const SURFACE = 'rgba(15,19,30,0.92)';
const SURFACE_SOFT = 'rgba(19,24,38,0.92)';
const BORDER = 'rgba(255,255,255,0.07)';

/** Тёмная play-кнопка с оранжевым кольцом и мягким ореолом (референс CTA). */
function PlayOrb({ size = 52 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 52 52">
      <Defs>
        <RadialGradient id="orbHalo" cx="0.5" cy="0.5" r="0.5">
          <Stop offset="0.62" stopColor="rgba(240,168,120,0.16)" />
          <Stop offset="0.8" stopColor="rgba(240,168,120,0.07)" />
          <Stop offset="1" stopColor="rgba(240,168,120,0)" />
        </RadialGradient>
        <RadialGradient id="orbCore" cx="0.38" cy="0.32" r="0.95">
          <Stop offset="0" stopColor="#332A4E" />
          <Stop offset="1" stopColor="#221C38" />
        </RadialGradient>
      </Defs>
      <Circle cx={26} cy={26} r={26} fill="url(#orbHalo)" />
      <Circle cx={26} cy={26} r={20} fill="url(#orbCore)"
        stroke="#E0946A" strokeWidth={1.5} />
      <Path d="M22.5 19.5v13l10.5-6.5z" fill="#F5B58A" />
    </Svg>
  );
}

/** #4: кольцо дневной цели (done/goal). БЕЗ 🔥 внутри — стрик отдельный (S3). */
function DailyRing({ done, goal, size = 46 }: { done: number; goal: number; size?: number }) {
  const r = (size - 5) / 2;
  const circ = 2 * Math.PI * r;
  const pct = Math.min(1, goal > 0 ? done / goal : 0);
  const complete = done >= goal;
  const color = complete ? '#8FBF9E' : '#F0A36A';
  return (
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <Circle cx={size / 2} cy={size / 2} r={r} stroke="rgba(255,255,255,0.12)" strokeWidth={3.5} fill="none" />
      <Circle
        cx={size / 2} cy={size / 2} r={r} stroke={color} strokeWidth={3.5} fill="none"
        strokeDasharray={`${circ * pct} ${circ}`} strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
    </Svg>
  );
}

export default function TrainingScreen({ navigation }: { navigation: any }) {
  const t = useT();
  const profile = useTrainingProfile();
  const access = useAccess();
  const width = Dimensions.get('window').width - 32;

  const stats = useMemo(
    () => (profile ? domainStats(profile) : []),
    [profile]
  );

  if (!access.open) {
    return (
      <View style={styles.lockPage}>
        <Text style={styles.lockText}>{t('training_locked')}</Text>
        <PrimaryButton
          label={t('open_subscription')}
          onPress={() => navigation.getParent()?.navigate('Paywall')}
        />
      </View>
    );
  }

  if (!profile) return null;

  const attempts = profile.solved + profile.failed;
  const accuracy = attempts ? Math.round((profile.solved / attempts) * 100) : null;
  const rating = Math.round((profile as any).auser);
  const dueCount = dueReviewCount(profile);
  const doneToday = todayProgress(profile);
  const goalMet = doneToday >= DAILY_GOAL;

  const byKey = new Map(stats.map((d) => [d.domain, d]));
  const axes: RadarAxis[] = RADAR_ORDER
    .filter((k) => byKey.has(k))
    .map((k) => {
      const d = byKey.get(k)!;
      return {
        key: k, label: t(d.label), solved: d.solved, total: d.total,
        // До первой попытки в домене фигура пустая: дефолтная EWMA 0.6 у
        // свежего профиля иначе рисует «освоенность 60%» на ровном месте.
        value: d.attempts > 0 ? d.mastery : 0,
        color: DOMAIN_COLORS[k] ?? ui.accent,
      };
    });

  return (
    <ScrollView contentContainerStyle={styles.page}>
      {/* карточка статов: очки · решено · точность · рейтинг */}
      <View style={styles.statsCard}>
        <View style={styles.statCell}>
          <Text style={styles.statBig} maxFontSizeMultiplier={1.1}>{profile.points}</Text>
          <Text style={styles.statSmall}>{t('stat_points')}</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statCell}>
          <Text style={styles.statBig} maxFontSizeMultiplier={1.1}>{profile.solved}</Text>
          <Text style={styles.statSmall}>{t('stat_solved')}</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statCell}>
          <Text style={styles.statBig} maxFontSizeMultiplier={1.1}>
            {accuracy != null ? `${accuracy}%` : '—'}
          </Text>
          <Text style={styles.statSmall}>{t('stat_accuracy')}</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statCell}>
          <Text style={styles.statRating} maxFontSizeMultiplier={1.1}>
            {rating}
            <Text style={styles.spark}> ✦</Text>
          </Text>
          <Text style={styles.statLevel}>{t(levelLabel(rating))}</Text>
        </View>
      </View>

      {/* #4: дневная цель — кольцо прогресса дня (стрик отдельный, S3) */}
      <View style={styles.goalCard}>
        <View style={styles.goalRingWrap}>
          <DailyRing done={doneToday} goal={DAILY_GOAL} />
          <Text style={styles.goalRingText} maxFontSizeMultiplier={1.1}>
            {Math.min(doneToday, DAILY_GOAL)}/{DAILY_GOAL}
          </Text>
        </View>
        <View style={styles.goalTextWrap}>
          <Text style={[styles.goalTitle, goalMet && styles.goalTitleDone]}>
            {goalMet ? t('goal_done') : t('goal_today')}
          </Text>
          {!goalMet && (
            <Text style={styles.goalNote}>{t('goal_left', { n: DAILY_GOAL - doneToday })}</Text>
          )}
        </View>
      </View>

      {/* Повторение по SRS (фаза 2): показываем, только если есть просроченные */}
      {dueCount > 0 && (
        <Pressable
          style={({ pressed }) => [styles.reviewCard, pressed && { opacity: 0.85 }]}
          onPress={() => {
            // #5: первый заход в повторы — помечаем, что объяснение показано.
            if (!profile.srsExplained) markSrsExplained();
            navigation.navigate('TrainingSession', { review: true });
          }}
        >
          <View style={styles.reviewBadge}>
            <Text style={styles.reviewBadgeText}>↻</Text>
          </View>
          <View style={styles.reviewTextWrap}>
            <Text style={styles.reviewTitle}>{t('review_due', { n: dueCount })}</Text>
            {/* #5: пока не объяснили — развёрнутое человеческое объяснение SRS,
                после первого захода — компактная нота. */}
            <Text style={[styles.reviewNote, !profile.srsExplained && styles.reviewNoteLong]}>
              {profile.srsExplained ? t('review_note') : t('review_explain')}
            </Text>
          </View>
          <Text style={styles.playChevron}>›</Text>
        </Pressable>
      )}

      {/* CTA: Играть */}
      <Pressable
        style={({ pressed }) => [styles.playCard, pressed && { opacity: 0.85 }]}
        onPress={() => navigation.navigate('TrainingSession')}
      >
        <PlayOrb />
        <View style={styles.playTextWrap}>
          <Text style={styles.playTitle}>{t('play_cta')}</Text>
          <Text style={styles.playNote} numberOfLines={2}>{t('play_note')}</Text>
        </View>
        <View style={styles.playChevronWrap}>
          <Text style={styles.playChevron}>›</Text>
        </View>
      </Pressable>

      {/* звезда навыков */}
      <View style={styles.starHead}>
        <View style={styles.starTitleRow}>
          <Text style={styles.sectionTitle}>{t('star_title')}</Text>
          <Pressable
            hitSlop={8}
            onPress={() => Alert.alert(t('star_info_title'), t('star_info_body'))}
          >
            <View style={styles.infoDot}><Text style={styles.infoDotText}>i</Text></View>
          </Pressable>
        </View>
        <View style={styles.legend}>
          <View style={styles.legendRow}>
            <View style={styles.legendSolid} />
            <Text style={styles.legendText}>{t('legend_current')}</Text>
          </View>
          <View style={styles.legendRow}>
            <View style={styles.legendDashWrap}>
              {[0, 1, 2].map((i) => <View key={i} style={styles.legendDash} />)}
            </View>
            <Text style={styles.legendText}>{t('legend_potential')}</Text>
          </View>
        </View>
      </View>

      <SkillRadar
        axes={axes}
        rating={rating}
        width={width}
        onSelect={(key) => navigation.navigate('TrainingSession', { domain: key })}
      />

      {/* прогресс по навыкам */}
      <View style={styles.progressCard}>
        <View style={styles.progressHead}>
          <Text style={styles.sectionTitle}>{t('progress_title')}</Text>
          <View style={styles.filterChip}>
            <Text style={styles.filterChipText}>{t('filter_all_skills')}  ⌄</Text>
          </View>
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.progressStrip}
        >
          {stats.map((d) => {
            const color = DOMAIN_COLORS[d.domain] ?? ui.accent;
            const pct = d.total ? Math.round((d.solved / d.total) * 100) : 0;
            return (
              <Pressable
                key={d.domain}
                onPress={() => navigation.navigate('TrainingSession', { domain: d.domain })}
                style={({ pressed }) => [styles.skillCard, pressed && { opacity: 0.6 }]}
              >
                <Text style={styles.skillName} numberOfLines={1}>{t(d.label)}</Text>
                <View style={styles.skillMid}>
                  <View style={[styles.skillIcon, { backgroundColor: `${color}20` }]}>
                    <DomainIcon domain={d.domain} size={17} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.skillCount} maxFontSizeMultiplier={1.05}>
                      {d.solved}
                      <Text style={styles.skillTotal}>/{d.total}</Text>
                    </Text>
                    <Text style={styles.skillLevel}>{t(d.level)}</Text>
                  </View>
                </View>
                <View style={styles.skillBarRow}>
                  <View style={styles.skillTrack}>
                    <View style={[styles.skillFill, {
                      backgroundColor: color,
                      width: `${Math.max(pct, 3)}%`,
                    }]} />
                  </View>
                  <Text style={styles.skillPct}>{pct}%</Text>
                </View>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      <Text style={styles.poolNote}>{t('pool_note', { n: trainingPool().length })}</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { padding: 16, gap: 12, paddingBottom: 36 },

  statsCard: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 10, paddingHorizontal: 4,
    backgroundColor: SURFACE, borderWidth: 1, borderColor: BORDER,
    borderRadius: 16,
  },
  statCell: { flex: 1, alignItems: 'center', gap: 1 },
  statDivider: { width: 1, height: 34, backgroundColor: 'rgba(255,255,255,0.09)' },
  statBig: {
    fontSize: 23, fontFamily: ui.serif, color: ui.ink,
    fontVariant: ['tabular-nums'],
  },
  statSmall: { fontSize: 11.5, color: '#8D919C' },
  statRating: {
    fontSize: 23, fontFamily: ui.serif, color: '#F0A36A',
    fontVariant: ['tabular-nums'],
  },
  spark: { fontSize: 12, color: '#F2C9A4' },
  statLevel: { fontSize: 11.5, color: ui.peach },

  playCard: {
    flexDirection: 'row', alignItems: 'center', gap: 11,
    borderRadius: 18, borderWidth: 1, borderColor: 'rgba(224,148,106,0.40)',
    backgroundColor: 'rgba(42,29,32,0.45)',
    paddingVertical: 11, paddingLeft: 11, paddingRight: 12,
  },
  playTextWrap: { flex: 1, gap: 2 },
  playTitle: { fontSize: 19, fontWeight: '700', color: ui.ink },
  playNote: { fontSize: 12.5, lineHeight: 17, color: '#9A98A2' },
  playChevronWrap: {
    width: 32, height: 32, borderRadius: 16, alignItems: 'center',
    justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)',
  },
  playChevron: { fontSize: 19, color: ui.inkSoft, marginTop: -2 },

  reviewCard: {
    flexDirection: 'row', alignItems: 'center', gap: 11,
    borderRadius: 16, borderWidth: 1, borderColor: 'rgba(154,120,255,0.42)',
    backgroundColor: 'rgba(122,92,255,0.13)',
    paddingVertical: 10, paddingLeft: 11, paddingRight: 12,
  },
  reviewBadge: {
    width: 38, height: 38, borderRadius: 19, alignItems: 'center',
    justifyContent: 'center', backgroundColor: 'rgba(154,120,255,0.20)',
    borderWidth: 1, borderColor: 'rgba(154,120,255,0.45)',
  },
  reviewBadgeText: { fontSize: 20, color: '#C5BBF0', marginTop: -1 },
  reviewTextWrap: { flex: 1, gap: 2 },
  reviewTitle: { fontSize: 16, fontWeight: '700', color: '#F1EDF9' },
  reviewNote: { fontSize: 12.5, lineHeight: 17, color: '#9E99B0' },
  reviewNoteLong: { lineHeight: 18, marginTop: 1 },

  goalCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderRadius: 16, borderWidth: 1, borderColor: 'rgba(224,148,106,0.30)',
    backgroundColor: 'rgba(42,29,32,0.35)',
    paddingVertical: 10, paddingLeft: 11, paddingRight: 14,
  },
  goalRingWrap: { width: 46, height: 46, alignItems: 'center', justifyContent: 'center' },
  goalRingText: {
    position: 'absolute', fontSize: 13, fontWeight: '700', color: ui.ink,
    fontVariant: ['tabular-nums'],
  },
  goalTextWrap: { flex: 1, gap: 2 },
  goalTitle: { fontSize: 16, fontWeight: '700', color: ui.ink },
  goalTitleDone: { color: '#9AD1A8' },
  goalNote: { fontSize: 12.5, lineHeight: 17, color: '#9A98A2' },

  starHead: {
    flexDirection: 'row', alignItems: 'flex-start',
    justifyContent: 'space-between', marginTop: 2,
  },
  starTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  sectionTitle: { fontSize: 18, fontWeight: '600', color: ui.ink },
  infoDot: {
    width: 17, height: 17, borderRadius: 9, borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.24)', alignItems: 'center',
    justifyContent: 'center', opacity: 0.7,
  },
  infoDotText: { fontSize: 10.5, color: ui.muted, fontStyle: 'italic' },
  legend: { gap: 4, alignItems: 'flex-end', paddingTop: 3 },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendSolid: { width: 18, height: 2.5, borderRadius: 2, backgroundColor: '#9876FF' },
  legendDashWrap: { flexDirection: 'row', gap: 2.5 },
  legendDash: { width: 4, height: 1.8, borderRadius: 1, backgroundColor: 'rgba(154,159,172,0.75)' },
  legendText: { fontSize: 11.5, color: '#858995' },

  progressCard: {
    padding: 12, gap: 10,
    backgroundColor: SURFACE, borderWidth: 1, borderColor: BORDER,
    borderRadius: 18,
  },
  progressHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  filterChip: {
    paddingVertical: 6, paddingHorizontal: 12, borderRadius: 12,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  filterChipText: { fontSize: 12.5, color: ui.inkSoft },
  progressStrip: { gap: 8, paddingRight: 4 },
  skillCard: {
    width: 128, borderRadius: 14, borderWidth: 1,
    borderColor: BORDER, backgroundColor: SURFACE_SOFT,
    padding: 10, gap: 7,
  },
  skillName: { fontSize: 12.5, fontWeight: '600', color: ui.inkSoft },
  skillMid: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  skillIcon: {
    width: 30, height: 30, borderRadius: 15,
    alignItems: 'center', justifyContent: 'center',
  },
  skillCount: { fontSize: 15, color: ui.ink, fontVariant: ['tabular-nums'] },
  skillTotal: { color: '#858A98', fontSize: 12.5 },
  skillLevel: { fontSize: 10.5, color: '#858A96' },
  skillBarRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  skillTrack: {
    flex: 1, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.10)',
  },
  skillFill: { height: 4, borderRadius: 2 },
  skillPct: { fontSize: 10.5, color: '#858A96', fontVariant: ['tabular-nums'] },

  poolNote: { fontSize: 12, color: ui.dim, textAlign: 'center', marginTop: 1 },
  lockPage: { flex: 1, justifyContent: 'center', padding: 24, gap: 12 },
  lockText: { fontSize: 15, color: ui.muted, textAlign: 'center', lineHeight: 22 },
});
