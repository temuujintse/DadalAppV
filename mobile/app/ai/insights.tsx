import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Lightbulb, Sparkles, TrendingDown, TrendingUp } from 'lucide-react-native';
import { AppText } from '@/components/ui/AppText';
import { BackHeader } from '@/components/ui/BackHeader';
import { Card } from '@/components/ui/Card';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { Screen } from '@/components/ui/Screen';
import { Segmented } from '@/components/ui/Segmented';
import { ListSkeleton } from '@/components/ui/Skeleton';
import { InlineError } from '@/components/ui/StateViews';
import { useAnalytics } from '@/features/ai/api';
import { errorMessage } from '@/services/api/errors';
import { colors, radius, spacing } from '@/theme';
import type { AIAnalytics } from '@/types/api';

const WEEKDAYS = ['Ня', 'Да', 'Мя', 'Лх', 'Пү', 'Ба', 'Бя'];
/** Monday-first display order of byWeekday (0 = Sunday). */
const ORDER = [1, 2, 3, 4, 5, 6, 0];

const fmt = (d: string) => d.slice(5).replace('-', '.');

/** Habit report: numbers from the server; the AI only explains them. */
export default function InsightsScreen() {
  const [period, setPeriod] = useState<'weekly' | 'monthly'>('weekly');
  const report = useAnalytics(period);

  return (
    <Screen refreshing={report.isRefetching} onRefresh={() => void report.refetch()}>
      <BackHeader title="Ахицын тайлан" />
      <Segmented
        value={period}
        onChange={setPeriod}
        accessibilityLabel="Тайлангийн хугацаа"
        options={[
          { value: 'weekly', label: 'Өнгөрсөн 7 хоног' },
          { value: 'monthly', label: 'Өнгөрсөн сар' },
        ]}
      />
      {report.isPending ? (
        <ListSkeleton rows={3} trailing={false} />
      ) : report.isError ? (
        <InlineError message={errorMessage(report.error)} onRetry={() => void report.refetch()} />
      ) : (
        <Report data={report.data} />
      )}
    </Screen>
  );
}

function Report({ data }: { data: AIAnalytics }) {
  const m = data.metrics;
  const up = m.rateChange >= 0;
  const max = Math.max(1, ...m.byWeekday);
  return (
    <>
      <Card>
        <AppText variant="caption" color={colors.secondary}>
          {fmt(m.from)} – {fmt(m.to)}
        </AppText>
        <View style={styles.big}>
          <AppText variant="display">{m.completionRate}%</AppText>
          <View style={styles.change}>
            {up ? <TrendingUp size={18} color={colors.successText} /> : <TrendingDown size={18} color={colors.errorText} />}
            <AppText variant="label" color={up ? colors.successText : colors.errorText}>
              {up ? '+' : ''}
              {m.rateChange} оноо
            </AppText>
          </View>
        </View>
        <ProgressBar progress={m.completionRate / 100} color={colors.success} accessibilityLabel={`Биелэлт ${m.completionRate}%`} />
        <AppText variant="caption" color={colors.secondary}>
          {m.completed} / {m.scheduled} төлөвлөсөн удаа биелсэн · Өмнөх үе {m.previous.completionRate}%
        </AppText>
      </Card>

      <View style={styles.row}>
        <Stat label="Хамгийн сайн" value={m.bestHabit?.title ?? '—'} sub={m.bestHabit ? `${m.bestHabit.completionRate}%` : ''} />
        <Stat
          label="Анхаарах"
          value={m.leastConsistentHabit?.title ?? '—'}
          sub={m.leastConsistentHabit ? `${m.leastConsistentHabit.completionRate}%` : ''}
        />
      </View>

      <Card>
        <AppText variant="label">Гарагаар</AppText>
        <View style={styles.bars} accessible accessibilityLabel={ORDER.map((d) => `${WEEKDAYS[d]} ${m.byWeekday[d]}`).join(', ')}>
          {ORDER.map((d) => (
            <View key={d} style={styles.barCol}>
              <View style={styles.barTrack}>
                <View style={[styles.bar, { height: `${(m.byWeekday[d] / max) * 100}%` }]} />
              </View>
              <AppText variant="caption" color={colors.secondary}>
                {WEEKDAYS[d]}
              </AppText>
            </View>
          ))}
        </View>
        <AppText variant="caption" color={colors.secondary}>
          Дундаж streak: {m.averageCurrentStreak} өдөр · {m.activeHabits} идэвхтэй дадал
        </AppText>
      </Card>

      <Card style={styles.ai}>
        <View style={styles.aiHead}>
          <Sparkles size={18} color={colors.purple} />
          <AppText variant="label" color={colors.purpleText}>
            AI тайлбар
          </AppText>
        </View>
        {data.insight ? (
          <>
            <AppText>{data.insight.summary}</AppText>
            {data.insight.positiveHighlights.map((t) => (
              <AppText key={t} variant="caption">
                ✅ {t}
              </AppText>
            ))}
            {data.insight.improvementAreas.map((t) => (
              <AppText key={t} variant="caption">
                🌱 {t}
              </AppText>
            ))}
            <AppText variant="caption" color={colors.secondary}>
              {data.insight.periodComparison}
            </AppText>
            {data.insight.suggestions.map((t) => (
              <View key={t} style={styles.tip}>
                <Lightbulb size={16} color={colors.warningText} />
                <AppText variant="caption" style={styles.flex}>
                  {t}
                </AppText>
              </View>
            ))}
          </>
        ) : (
          <AppText variant="caption" color={colors.secondary}>
            {data.insightMessage ?? 'AI тайлбар одоогоор алга.'}
          </AppText>
        )}
      </Card>
    </>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <Card style={styles.stat}>
      <AppText variant="caption" color={colors.secondary}>
        {label}
      </AppText>
      <AppText variant="bodyStrong" numberOfLines={2}>
        {value}
      </AppText>
      {sub ? (
        <AppText variant="caption" color={colors.secondary}>
          {sub}
        </AppText>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  big: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  change: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingBottom: spacing.xs },
  row: { flexDirection: 'row', gap: spacing.md },
  stat: { flex: 1, gap: 2 },
  bars: { flexDirection: 'row', justifyContent: 'space-between', height: 110, alignItems: 'flex-end' },
  barCol: { alignItems: 'center', gap: 4, flex: 1 },
  barTrack: { height: 84, width: 18, justifyContent: 'flex-end', borderRadius: radius.sm, backgroundColor: colors.surfaceMuted, overflow: 'hidden' },
  bar: { width: '100%', backgroundColor: colors.primary, borderRadius: radius.sm },
  ai: { backgroundColor: colors.purpleSoft },
  aiHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  tip: { flexDirection: 'row', gap: spacing.xs },
  flex: { flex: 1 },
});
