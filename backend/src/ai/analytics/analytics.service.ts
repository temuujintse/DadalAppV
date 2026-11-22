import { Injectable } from '@nestjs/common';
import { AppException } from '../../common/errors/app.exception';
import { ErrorCode } from '../../common/errors/error-codes';
import { fromDbDate, toDbDate } from '../../common/utils/local-date';
import { DEFAULT_TIMEZONE, localDateString } from '../../common/utils/timezone.util';
import { PrismaService } from '../../database/prisma.service';
import { Prisma } from '../../generated/prisma/client';
import { AIOrchestrator } from '../ai-orchestrator.service';
import { AnalyticsDto } from '../dto/analytics.dto';
import { Insight, INSIGHT_JSON_SCHEMA, insightSchema } from './insight.schemas';
import {
  computeMetrics,
  HabitMetrics,
  inventedNumbers,
  lastCompletePeriod,
  numbersAllowed,
  PeriodType,
  previousPeriod,
} from './metrics';

/**
 * AI Habit Analytics. Numbers come from PostgreSQL (computeMetrics); the AI only explains them
 * and may not invent figures. One insight per user and completed period, stored and reused.
 * Metrics are always returned, even when AI is unavailable.
 */
@Injectable()
export class AnalyticsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ai: AIOrchestrator,
  ) {}

  async get(userId: string, type: PeriodType): Promise<AnalyticsDto> {
    const metrics = await this.metrics(userId, type);
    const stored = await this.prisma.aIInsight.findUnique({
      where: {
        userId_periodType_periodKey: { userId, periodType: type, periodKey: metrics.periodKey },
      },
    });
    if (stored) {
      return {
        metrics,
        insight: stored.insight as unknown as Insight,
        insightStatus: 'READY',
        insightMessage: null,
      };
    }
    if (metrics.scheduled === 0) {
      return {
        metrics,
        insight: null,
        insightStatus: 'NO_DATA',
        insightMessage: 'Энэ хугацаанд төлөвлөгдсөн дадал байгаагүй тул тайлбар үүсгэсэнгүй.',
      };
    }

    let insight: Insight;
    try {
      const allowed = numbersAllowed(metrics);
      insight = await this.ai.run(
        userId,
        'ANALYTICS',
        {
          instructions: INSTRUCTIONS,
          input: [
            {
              role: 'user',
              content: `Metrics computed by the app (trusted, the only facts you may use):\n${JSON.stringify(metrics)}`,
            },
          ],
          schemaName: 'habit_insight',
          schema: INSIGHT_JSON_SCHEMA,
          maxOutputTokens: 700,
        },
        (data) => {
          const out = insightSchema.parse(data);
          const bad = inventedNumbers(texts(out), allowed);
          if (bad.length) throw new Error(`Invented numbers: ${bad.join(',')}`);
          return out;
        },
        texts,
      );
    } catch (err) {
      if (err instanceof AppException) {
        return {
          metrics,
          insight: null,
          insightStatus: err.code === ErrorCode.AI_DISABLED ? 'DISABLED' : 'UNAVAILABLE',
          insightMessage: err.message,
        };
      }
      throw err;
    }

    try {
      await this.prisma.aIInsight.create({
        data: {
          userId,
          periodType: type,
          periodKey: metrics.periodKey,
          metrics: metrics as unknown as Prisma.InputJsonValue,
          insight: insight,
        },
      });
    } catch (err) {
      // A parallel request stored the same period first; keep the stored one.
      if (!(err instanceof Prisma.PrismaClientKnownRequestError) || err.code !== 'P2002') throw err;
      const first = await this.prisma.aIInsight.findUniqueOrThrow({
        where: {
          userId_periodType_periodKey: { userId, periodType: type, periodKey: metrics.periodKey },
        },
      });
      insight = first.insight as unknown as Insight;
    }
    return { metrics, insight, insightStatus: 'READY', insightMessage: null };
  }

  private async metrics(userId: string, type: PeriodType): Promise<HabitMetrics> {
    const profile = await this.prisma.userProfile.findUnique({
      where: { userId },
      select: { timezone: true },
    });
    const today = localDateString(profile?.timezone ?? DEFAULT_TIMEZONE);
    const period = lastCompletePeriod(type, today);
    const prev = previousPeriod(period);

    const [habits, completions, streaks] = await Promise.all([
      this.prisma.habit.findMany({
        where: { status: 'ACTIVE', deletedAt: null, assignments: { some: { userId } } },
        include: { scheduleDays: { select: { weekday: true } } },
      }),
      this.prisma.habitCompletion.findMany({
        where: {
          completedById: userId,
          localDate: { gte: toDbDate(prev.from), lte: toDbDate(period.to) },
        },
        select: { habitId: true, localDate: true },
      }),
      this.prisma.habitStreak.findMany({ where: { userId }, select: { currentStreak: true } }),
    ]);

    return computeMetrics(
      period,
      habits.map((h) => ({
        id: h.id,
        title: h.title,
        scheduleDays: h.scheduleDays.map((d) => d.weekday),
        startDate: fromDbDate(h.startDate),
        endDate: h.endDate ? fromDbDate(h.endDate) : null,
      })),
      completions.map((c) => ({ habitId: c.habitId, localDate: fromDbDate(c.localDate) })),
      streaks.map((s) => s.currentStreak),
    );
  }
}

function texts(i: Insight): string[] {
  return [
    i.summary,
    i.periodComparison,
    ...i.positiveHighlights,
    ...i.improvementAreas,
    ...i.suggestions,
  ];
}

const INSTRUCTIONS = `You explain a user's habit statistics in "Family Habit".
Write in Mongolian (Cyrillic), warm and encouraging; never shame or blame.
Use ONLY the numbers present in the metrics JSON — never invent, estimate or round to new figures.
completionRate values are percentages. byWeekday is indexed 0 = Sunday … 6 = Saturday.
Highlight what went well, gently name at most two areas to improve, and give 1–3 concrete,
small suggestions about habits only (no medical, diet or psychological advice, no links).
periodComparison compares with "previous" (the period before).`;
