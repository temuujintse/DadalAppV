import { Injectable } from '@nestjs/common';
import { AppException } from '../../common/errors/app.exception';
import { ErrorCode } from '../../common/errors/error-codes';
import { addDays, fromDbDate, toDbDate } from '../../common/utils/local-date';
import { DEFAULT_TIMEZONE, localDateString } from '../../common/utils/timezone.util';
import { PrismaService } from '../../database/prisma.service';
import { AIPlan, AIPlanItem, Prisma } from '../../generated/prisma/client';
import { ListHabitsQueryDto } from '../../habits/dto/habit.dto';
import { HabitsService } from '../../habits/habits.service';
import { AIOrchestrator } from '../ai-orchestrator.service';
import { DayPlansDto, GeneratePlanDto, PlanDto, PlanWarningDto } from '../dto/planner.dto';
import {
  DEFAULT_MINUTES,
  PlanCandidate,
  PlanWindow,
  roundUpTo5,
  toMinutes,
  validatePlan,
} from './plan-rules';
import { plannerInput, plannerInstructions, PlannerContext } from './planner.prompts';
import { planJsonSchema, planOutputSchema } from './planner.schemas';

type PlanWithItems = AIPlan & { items: (AIPlanItem & { habit: { title: string } })[] };

interface PlanPayload {
  summary: string;
  warnings: PlanWarningDto[];
  /** The window the user asked for (regenerate reuses it). */
  window?: PlanWindow;
}

const DEFAULT_WINDOW: PlanWindow = { from: '07:00', to: '22:00' };

/**
 * AI Smart Planner. The model proposes a time for each of today's open habits; the backend
 * validates (only real open habits, inside the window, no overlaps, overload warning) and stores
 * a DRAFT. The plan becomes ACTIVE only when the user confirms it (one ACTIVE plan per day).
 */
@Injectable()
export class PlannerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ai: AIOrchestrator,
    private readonly habits: HabitsService,
  ) {}

  async generate(userId: string, dto: GeneratePlanDto): Promise<PlanDto> {
    const replay = await this.prisma.aIPlan.findUnique({
      where: { userId_requestKey: { userId, requestKey: dto.idempotencyKey } },
      include: ITEMS,
    });
    if (replay) return this.toDto(userId, replay);

    const today = await this.today(userId);
    const nowLocal = this.localTime(await this.timezone(userId));
    const requested: PlanWindow = {
      from: dto.availableFrom ?? DEFAULT_WINDOW.from,
      to: dto.availableTo ?? DEFAULT_WINDOW.to,
    };
    const window: PlanWindow = {
      from: maxTime(requested.from, roundUpTo5(nowLocal)),
      to: requested.to,
    };
    if (toMinutes(window.to) - toMinutes(window.from) < 15) {
      throw AppException.badRequest(
        ErrorCode.VALIDATION_ERROR,
        'Өнөөдөр төлөвлөх хангалттай цаг үлдээгүй байна.',
      );
    }

    const open = (await this.habits.list(userId, todayQuery())).filter(
      (h) => h.canComplete && h.today.isScheduled && !h.today.isCompleted,
    );
    if (!open.length) {
      throw AppException.conflict(
        ErrorCode.CONFLICT,
        'Өнөөдөр төлөвлөх дадал үлдээгүй байна. Гайхалтай! 🎉',
      );
    }
    const candidates: PlanCandidate[] = open.map((h, i) => ({
      ref: `h${i + 1}`,
      habitId: h.id,
      title: h.title,
      difficulty: h.difficulty,
      reminderTime: h.reminderTime,
    }));

    const [membership, pref] = await Promise.all([
      this.prisma.familyMember.findUnique({ where: { userId }, select: { role: true } }),
      this.prisma.aIUserPreference.findUnique({ where: { userId } }),
    ]);
    const ctx: PlannerContext = {
      audience: membership?.role === 'CHILD' ? 'child' : 'adult',
      date: today,
      window,
      availableMinutesPerDay: pref?.availableMinutesPerDay ?? null,
      habits: candidates.map((c) => ({
        ref: c.ref,
        title: c.title,
        difficulty: c.difficulty,
        reminderTime: c.reminderTime,
        suggestedMinutes: DEFAULT_MINUTES[c.difficulty],
      })),
      yesterday: await this.yesterdayPerformance(userId, today),
    };

    const result = await this.ai.run(
      userId,
      'PLANNER',
      {
        instructions: plannerInstructions(ctx),
        input: [{ role: 'user', content: plannerInput(ctx) }],
        schemaName: 'day_plan',
        schema: planJsonSchema(candidates.map((c) => c.ref)),
        maxOutputTokens: 900,
      },
      (data) => {
        const out = planOutputSchema.parse(data);
        const checked = validatePlan(out.items, candidates, window, ctx.availableMinutesPerDay);
        if (!checked.items.length) throw new Error('Empty plan');
        return { summary: out.summary, ...checked };
      },
      (r) => [r.summary, ...r.items.map((i) => i.note ?? '')],
    );

    const payload: PlanPayload = {
      summary: result.summary,
      warnings: result.warnings,
      window: requested,
    };
    try {
      const plan = await this.prisma.aIPlan.create({
        data: {
          userId,
          planDate: toDbDate(today),
          requestKey: dto.idempotencyKey,
          payload: payload as unknown as Prisma.InputJsonValue,
          items: {
            create: result.items.map((i) => ({
              habitId: i.habitId,
              startTime: i.startTime,
              durationMinutes: i.durationMinutes,
              order: i.order,
              note: i.note,
            })),
          },
        },
        include: ITEMS,
      });
      return this.toDto(userId, plan);
    } catch (err) {
      // A concurrent retry with the same key stored it first.
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        const again = await this.prisma.aIPlan.findUniqueOrThrow({
          where: { userId_requestKey: { userId, requestKey: dto.idempotencyKey } },
          include: ITEMS,
        });
        return this.toDto(userId, again);
      }
      throw err;
    }
  }

  async forDay(userId: string, date?: string): Promise<DayPlansDto> {
    const day = date ?? (await this.today(userId));
    const plans = await this.prisma.aIPlan.findMany({
      where: { userId, planDate: toDbDate(day), status: { in: ['ACTIVE', 'DRAFT'] } },
      orderBy: { createdAt: 'desc' },
      include: ITEMS,
    });
    const active = plans.find((p) => p.status === 'ACTIVE') ?? null;
    const draft = plans.find((p) => p.status === 'DRAFT') ?? null;
    return {
      date: day,
      active: active ? await this.toDto(userId, active) : null,
      draft: draft ? await this.toDto(userId, draft) : null,
    };
  }

  async confirm(userId: string, id: string): Promise<PlanDto> {
    const plan = await this.owned(userId, id);
    if (plan.status === 'ACTIVE') return this.toDto(userId, plan);
    if (plan.status !== 'DRAFT') {
      throw AppException.conflict(ErrorCode.CONFLICT, 'Энэ төлөвлөгөө идэвхгүй болсон байна.');
    }
    if (fromDbDate(plan.planDate) < (await this.today(userId))) {
      throw AppException.gone(
        ErrorCode.CONFLICT,
        'Өнгөрсөн өдрийн төлөвлөгөөг идэвхжүүлэх боломжгүй.',
      );
    }
    const confirmed = await this.prisma.$transaction(async (tx) => {
      await tx.aIPlan.updateMany({
        where: { userId, planDate: plan.planDate, status: 'ACTIVE' },
        data: { status: 'CANCELLED' },
      });
      const claimed = await tx.aIPlan.updateMany({
        where: { id, userId, status: 'DRAFT' },
        data: { status: 'ACTIVE', confirmedAt: new Date() },
      });
      if (claimed.count !== 1) {
        throw AppException.conflict(
          ErrorCode.CONFLICT,
          'Энэ төлөвлөгөөг өөрчилсөн байна. Дахин ачаална уу.',
        );
      }
      // Other drafts of the day are superseded.
      await tx.aIPlan.updateMany({
        where: { userId, planDate: plan.planDate, status: 'DRAFT' },
        data: { status: 'CANCELLED' },
      });
      return tx.aIPlan.findUniqueOrThrow({ where: { id }, include: ITEMS });
    });
    return this.toDto(userId, confirmed);
  }

  async regenerate(userId: string, id: string, idempotencyKey: string): Promise<PlanDto> {
    const plan = await this.owned(userId, id);
    if (plan.status !== 'DRAFT' && plan.status !== 'ACTIVE') {
      throw AppException.conflict(ErrorCode.CONFLICT, 'Энэ төлөвлөгөө идэвхгүй болсон байна.');
    }
    const previous = (plan.payload as unknown as PlanPayload).window;
    const next = await this.generate(userId, {
      idempotencyKey,
      availableFrom: previous?.from,
      availableTo: previous?.to,
    });
    if (plan.status === 'DRAFT' && next.id !== plan.id) {
      await this.prisma.aIPlan.updateMany({
        where: { id, status: 'DRAFT' },
        data: { status: 'CANCELLED' },
      });
    }
    return next;
  }

  // ───────────── Internals ─────────────

  private async owned(userId: string, id: string): Promise<PlanWithItems> {
    const plan = await this.prisma.aIPlan.findFirst({ where: { id, userId }, include: ITEMS });
    if (!plan) throw AppException.notFound(ErrorCode.NOT_FOUND, 'Төлөвлөгөө олдсонгүй.');
    return plan;
  }

  private async timezone(userId: string): Promise<string> {
    const p = await this.prisma.userProfile.findUnique({
      where: { userId },
      select: { timezone: true },
    });
    return p?.timezone ?? DEFAULT_TIMEZONE;
  }

  private async today(userId: string): Promise<string> {
    return localDateString(await this.timezone(userId));
  }

  private localTime(tz: string): string {
    return new Intl.DateTimeFormat('en-GB', {
      timeZone: tz,
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).format(new Date());
  }

  /** Previous plan performance: how much of yesterday's ACTIVE plan was completed. */
  private async yesterdayPerformance(userId: string, today: string) {
    const yesterday = addDays(today, -1);
    const plan = await this.prisma.aIPlan.findFirst({
      where: { userId, planDate: toDbDate(yesterday), status: { in: ['ACTIVE', 'COMPLETED'] } },
      include: { items: { select: { habitId: true } } },
    });
    if (!plan) return null;
    const completed = await this.prisma.habitCompletion.count({
      where: {
        completedById: userId,
        localDate: toDbDate(yesterday),
        habitId: { in: plan.items.map((i) => i.habitId) },
      },
    });
    return { planned: plan.items.length, completed };
  }

  private async toDto(userId: string, plan: PlanWithItems): Promise<PlanDto> {
    const date = fromDbDate(plan.planDate);
    const done = await this.prisma.habitCompletion.findMany({
      where: {
        localDate: plan.planDate,
        habitId: { in: plan.items.map((i) => i.habitId) },
        OR: [{ completedById: userId }, { userId: null }],
      },
      select: { habitId: true },
    });
    const doneIds = new Set(done.map((d) => d.habitId));
    const payload = plan.payload as unknown as PlanPayload;
    const items = [...plan.items].sort((a, b) => a.order - b.order);
    return {
      id: plan.id,
      date,
      status: plan.status,
      summary: payload.summary,
      warnings: payload.warnings ?? [],
      items: items.map((i) => ({
        id: i.id,
        habitId: i.habitId,
        title: i.habit.title,
        startTime: i.startTime,
        durationMinutes: i.durationMinutes,
        order: i.order,
        note: i.note,
        completed: doneIds.has(i.habitId),
      })),
      totalMinutes: items.reduce((s, i) => s + i.durationMinutes, 0),
      confirmedAt: plan.confirmedAt?.toISOString() ?? null,
      createdAt: plan.createdAt.toISOString(),
    };
  }
}

const ITEMS = { items: { include: { habit: { select: { title: true } } } } } as const;

function todayQuery(): ListHabitsQueryDto {
  return Object.assign(new ListHabitsQueryDto(), { scope: 'today', status: 'ACTIVE' });
}

function maxTime(a: string, b: string): string {
  return toMinutes(a) >= toMinutes(b) ? a : b;
}
