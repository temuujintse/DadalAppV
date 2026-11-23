import { HttpStatus, Injectable } from '@nestjs/common';
import { AuditAction, AuditService } from '../common/audit/audit.service';
import { AppException } from '../common/errors/app.exception';
import { ErrorCode } from '../common/errors/error-codes';
import { addDays, fromDbDate, monthBounds, toDbDate, weekdayOf } from '../common/utils/local-date';
import { DEFAULT_TIMEZONE, localDateString } from '../common/utils/timezone.util';
import { PrismaService, PrismaTx } from '../database/prisma.service';
import { FamilyAccessService, MembershipWithFamily } from '../families/family-access.service';
import { FamilyPermission } from '../families/family-policy';
import { HABIT_XP } from '../gamification/xp-rules';
import { Prisma } from '../generated/prisma/client';
import { effectiveStreak } from '../streaks/streak-calculator';
import {
  CalendarQueryDto,
  CreateHabitDto,
  HabitCalendarDto,
  HabitDetailDto,
  HabitDto,
  ListHabitsQueryDto,
  PersonRefDto,
  SetAssignmentsDto,
  UpdateHabitDto,
} from './dto/habit.dto';
import { canCompleteHabit, canManageHabit, canViewHabit } from './habit-policy';
import { photoUrl } from '../common/utils/photo-url';

export const HABIT_INCLUDE = {
  scheduleDays: { select: { weekday: true } },
  assignments: {
    select: {
      userId: true,
      user: {
        select: {
          profile: { select: { displayName: true, avatarKey: true, photoUpdatedAt: true } },
        },
      },
    },
    orderBy: { createdAt: 'asc' },
  },
} satisfies Prisma.HabitInclude;

export type HabitWithRelations = Prisma.HabitGetPayload<{ include: typeof HABIT_INCLUDE }>;

export const COMPLETION_ACTOR_INCLUDE = {
  completedBy: {
    select: {
      id: true,
      profile: { select: { displayName: true, avatarKey: true, photoUpdatedAt: true } },
    },
  },
} satisfies Prisma.HabitCompletionInclude;

type CompletionWithActor = Prisma.HabitCompletionGetPayload<{
  include: typeof COMPLETION_ACTOR_INCLUDE;
}>;

export interface HabitContext {
  habit: HabitWithRelations;
  membership: MembershipWithFamily | null;
  canManage: boolean;
  canComplete: boolean;
  /** Today in the habit's timezone */
  today: string;
}

const MAX_START_AHEAD_DAYS = 365;

@Injectable()
export class HabitsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: FamilyAccessService,
    private readonly audit: AuditService,
  ) {}

  // ───────────────────────────── Queries ─────────────────────────────

  async list(userId: string, query: ListHabitsQueryDto): Promise<HabitDto[]> {
    const membership = await this.access.findMembership(userId);
    const scopes: Prisma.HabitWhereInput[] = [];
    if (query.scope !== 'family') scopes.push({ type: 'PERSONAL', creatorId: userId });
    if (query.scope !== 'personal' && membership) {
      scopes.push({ type: 'FAMILY', familyId: membership.familyId });
    }
    if (scopes.length === 0) return [];

    const habits = await this.prisma.habit.findMany({
      where: {
        deletedAt: null,
        status: query.scope === 'today' ? 'ACTIVE' : query.status,
        OR: scopes,
      },
      include: HABIT_INCLUDE,
      orderBy: [{ createdAt: 'asc' }],
    });

    const dtos = await this.presentMany(habits, userId, membership);
    return query.scope === 'today'
      ? dtos.filter((h) => h.canComplete && h.today.isScheduled)
      : dtos;
  }

  async getDetail(userId: string, habitId: string): Promise<HabitDetailDto> {
    const ctx = await this.loadContext(userId, habitId);
    const [dto] = await this.presentMany([ctx.habit], userId, ctx.membership);

    let todayByMember: HabitDetailDto['todayByMember'] = null;
    if (ctx.habit.type === 'FAMILY' && ctx.habit.completionMode === 'PER_MEMBER') {
      const done = await this.prisma.habitCompletion.findMany({
        where: { habitId, localDate: toDbDate(ctx.today) },
        select: { userId: true },
      });
      const doneIds = new Set(done.map((c) => c.userId));
      todayByMember = dto.assignees.map((a) => ({ ...a, completed: doneIds.has(a.userId) }));
    }
    return { ...dto, todayByMember };
  }

  async calendar(
    userId: string,
    habitId: string,
    query: CalendarQueryDto,
  ): Promise<HabitCalendarDto> {
    const ctx = await this.loadContext(userId, habitId);
    const month = query.month ?? ctx.today.slice(0, 7);
    const { first, last } = monthBounds(month);
    const shared = ctx.habit.completionMode === 'SHARED';

    const rows = await this.prisma.habitCompletion.findMany({
      where: {
        habitId,
        localDate: { gte: toDbDate(first), lte: toDbDate(last) },
        ...(shared ? { userId: null } : { userId }),
      },
      select: { localDate: true },
    });
    const completed = new Set(rows.map((r) => fromDbDate(r.localDate)));

    const days: HabitCalendarDto['days'] = [];
    for (let d = first; d <= last; d = addDays(d, 1)) {
      days.push({
        date: d,
        isScheduled: this.isScheduledOn(ctx.habit, d),
        isCompleted: completed.has(d),
        isFuture: d > ctx.today,
      });
    }
    return {
      month,
      today: ctx.today,
      days,
      scheduledCount: days.filter((d) => d.isScheduled && !d.isFuture).length,
      completedCount: days.filter((d) => d.isCompleted).length,
    };
  }

  // ───────────────────────────── Commands ─────────────────────────────

  async create(userId: string, dto: CreateHabitDto): Promise<HabitDetailDto> {
    const profile = await this.prisma.userProfile.findUnique({ where: { userId } });
    let familyId: string | null = null;
    let timezone = profile?.timezone ?? DEFAULT_TIMEZONE;
    let assigneeIds: string[] = [userId];

    if (dto.type === 'PERSONAL') {
      if (dto.completionMode || dto.assignedUserIds) {
        throw AppException.badRequest(
          ErrorCode.VALIDATION_ERROR,
          'Хувийн дадалд биелүүлэх горим болон гишүүн оноох боломжгүй.',
          [
            {
              field: dto.completionMode ? 'completionMode' : 'assignedUserIds',
              errors: ['not allowed for PERSONAL'],
            },
          ],
        );
      }
    } else {
      const membership = await this.access.requirePermission(
        userId,
        FamilyPermission.MANAGE_FAMILY_HABITS,
      );
      familyId = membership.familyId;
      timezone = membership.family.timezone;
      assigneeIds = await this.resolveAssignees(membership.familyId, dto.assignedUserIds);
    }

    const today = localDateString(timezone);
    const startDate = dto.startDate ?? today;
    this.assertDateRange(startDate, dto.endDate ?? null, today);

    const habit = await this.prisma.$transaction(async (tx) => {
      const created = await tx.habit.create({
        data: {
          creatorId: userId,
          familyId,
          title: dto.title,
          description: dto.description || null,
          icon: dto.icon ?? 'sparkles',
          color: dto.color ?? '#F97316',
          type: dto.type,
          completionMode: dto.type === 'FAMILY' ? dto.completionMode : null,
          difficulty: dto.difficulty ?? 'EASY',
          startDate: toDbDate(startDate),
          endDate: dto.endDate ? toDbDate(dto.endDate) : null,
          reminderTime: dto.reminderTime ?? null,
          timezone,
          scheduleDays: { createMany: { data: dto.scheduleDays.map((weekday) => ({ weekday })) } },
          assignments: {
            createMany: { data: assigneeIds.map((id) => ({ userId: id, assignedById: userId })) },
          },
        },
      });
      await this.audit.record(
        {
          action: AuditAction.HABIT_CREATED,
          entityType: 'Habit',
          entityId: created.id,
          familyId: familyId ?? undefined,
          actorId: userId,
          metadata: { type: dto.type, completionMode: dto.completionMode ?? null },
        },
        tx,
      );
      return created;
    });

    return this.getDetail(userId, habit.id);
  }

  async update(userId: string, habitId: string, dto: UpdateHabitDto): Promise<HabitDetailDto> {
    const ctx = await this.loadContext(userId, habitId);
    this.assertCanManage(ctx);

    if (dto.endDate !== undefined && dto.endDate !== null) {
      const start = fromDbDate(ctx.habit.startDate);
      if (dto.endDate < start || dto.endDate < ctx.today) {
        throw this.dateOutOfRange('Дуусах огноо эхлэх огноо болон өнөөдрөөс өмнө байж болохгүй.');
      }
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.habit.update({
        where: { id: habitId },
        data: {
          title: dto.title,
          description: dto.description === undefined ? undefined : dto.description || null,
          icon: dto.icon,
          color: dto.color,
          difficulty: dto.difficulty,
          status: dto.status,
          endDate:
            dto.endDate === undefined ? undefined : dto.endDate ? toDbDate(dto.endDate) : null,
          reminderTime: dto.reminderTime === undefined ? undefined : dto.reminderTime,
        },
      });
      if (dto.scheduleDays) {
        await tx.habitScheduleDay.deleteMany({ where: { habitId } });
        await tx.habitScheduleDay.createMany({
          data: dto.scheduleDays.map((weekday) => ({ habitId, weekday })),
        });
      }
      await this.audit.record(
        {
          action: AuditAction.HABIT_UPDATED,
          entityType: 'Habit',
          entityId: habitId,
          familyId: ctx.habit.familyId ?? undefined,
          actorId: userId,
          metadata: { fields: Object.keys(dto) },
        },
        tx,
      );
    });
    return this.getDetail(userId, habitId);
  }

  /** Soft delete: the habit disappears, its completions and streak history stay. */
  async remove(userId: string, habitId: string): Promise<null> {
    const ctx = await this.loadContext(userId, habitId);
    this.assertCanManage(ctx);
    await this.prisma.$transaction(async (tx) => {
      await tx.habit.update({
        where: { id: habitId },
        data: { deletedAt: new Date(), status: 'ARCHIVED' },
      });
      await this.audit.record(
        {
          action: AuditAction.HABIT_DELETED,
          entityType: 'Habit',
          entityId: habitId,
          familyId: ctx.habit.familyId ?? undefined,
          actorId: userId,
        },
        tx,
      );
    });
    return null;
  }

  async setAssignments(
    userId: string,
    habitId: string,
    dto: SetAssignmentsDto,
  ): Promise<HabitDetailDto> {
    const ctx = await this.loadContext(userId, habitId);
    this.assertCanManage(ctx);
    if (ctx.habit.type !== 'FAMILY' || !ctx.habit.familyId) {
      throw AppException.badRequest(
        ErrorCode.BAD_REQUEST,
        'Зөвхөн гэр бүлийн дадалд гишүүн онооно.',
      );
    }
    const userIds = await this.resolveAssignees(ctx.habit.familyId, dto.userIds);

    await this.prisma.$transaction(async (tx) => {
      await tx.habitAssignment.deleteMany({ where: { habitId, userId: { notIn: userIds } } });
      await tx.habitAssignment.createMany({
        data: userIds.map((id) => ({ habitId, userId: id, assignedById: userId })),
        skipDuplicates: true,
      });
      await this.audit.record(
        {
          action: AuditAction.HABIT_ASSIGNMENTS_CHANGED,
          entityType: 'Habit',
          entityId: habitId,
          familyId: ctx.habit.familyId ?? undefined,
          actorId: userId,
          metadata: { userIds },
        },
        tx,
      );
    });
    return this.getDetail(userId, habitId);
  }

  // ───────────────────────────── Shared helpers ─────────────────────────────

  /** Loads a habit the caller may see (404 otherwise) plus the caller's rights on it. */
  async loadContext(userId: string, habitId: string, tx?: PrismaTx): Promise<HabitContext> {
    const db = tx ?? this.prisma;
    const habit = await db.habit.findFirst({
      where: { id: habitId, deletedAt: null },
      include: HABIT_INCLUDE,
    });
    const membership = await this.access.findMembership(userId, tx);
    const input = habit && {
      habit,
      userId,
      membership,
      assigneeIds: habit.assignments.map((a) => a.userId),
    };
    if (!habit || !input || !canViewHabit(input)) {
      throw AppException.notFound(ErrorCode.HABIT_NOT_FOUND, 'Дадал олдсонгүй.');
    }
    return {
      habit,
      membership,
      canManage: canManageHabit(input),
      canComplete: canCompleteHabit(input),
      today: localDateString(habit.timezone),
    };
  }

  isScheduledOn(habit: HabitWithRelations, date: string): boolean {
    if (date < fromDbDate(habit.startDate)) return false;
    if (habit.endDate && date > fromDbDate(habit.endDate)) return false;
    return habit.scheduleDays.some((d) => d.weekday === weekdayOf(date));
  }

  /** Maps habits to DTOs with today's state and streaks, batching all lookups. */
  async presentMany(
    habits: HabitWithRelations[],
    userId: string,
    membership: MembershipWithFamily | null,
  ): Promise<HabitDto[]> {
    if (habits.length === 0) return [];
    const ids = habits.map((h) => h.id);
    const todayOf = new Map(habits.map((h) => [h.id, localDateString(h.timezone)]));
    const dates = [...new Set(todayOf.values())].map(toDbDate);
    const sharedIds = habits.filter((h) => h.completionMode === 'SHARED').map((h) => h.id);

    const [todayCompletions, streakRows, familyStreakRows] = await Promise.all([
      this.prisma.habitCompletion.findMany({
        where: {
          habitId: { in: ids },
          localDate: { in: dates },
          OR: [{ userId }, { userId: null }],
        },
        include: COMPLETION_ACTOR_INCLUDE,
      }),
      this.prisma.habitStreak.findMany({ where: { userId, habitId: { in: ids } } }),
      sharedIds.length
        ? this.prisma.familyHabitStreak.findMany({ where: { habitId: { in: sharedIds } } })
        : Promise.resolve([]),
    ]);

    const completionFor = (habit: HabitWithRelations, today: string) =>
      todayCompletions.find(
        (c) =>
          c.habitId === habit.id &&
          fromDbDate(c.localDate) === today &&
          (habit.completionMode === 'SHARED' ? c.userId === null : c.userId === userId),
      ) ?? null;

    return habits.map((habit) => {
      const today = todayOf.get(habit.id)!;
      const input = {
        habit,
        userId,
        membership,
        assigneeIds: habit.assignments.map((a) => a.userId),
      };
      const completion = completionFor(habit, today);
      const stored =
        habit.completionMode === 'SHARED'
          ? familyStreakRows.find((s) => s.habitId === habit.id)
          : streakRows.find((s) => s.habitId === habit.id);
      const scheduleDays = habit.scheduleDays.map((d) => d.weekday).sort((a, b) => a - b);

      return {
        id: habit.id,
        type: habit.type,
        completionMode: habit.completionMode,
        title: habit.title,
        description: habit.description,
        icon: habit.icon,
        color: habit.color,
        difficulty: habit.difficulty,
        xpReward: HABIT_XP[habit.difficulty],
        status: habit.status,
        startDate: fromDbDate(habit.startDate),
        endDate: habit.endDate ? fromDbDate(habit.endDate) : null,
        reminderTime: habit.reminderTime,
        timezone: habit.timezone,
        scheduleDays,
        familyId: habit.familyId,
        creatorId: habit.creatorId,
        assignees: habit.assignments.map((a) => this.person(a.userId, a.user.profile)),
        canManage: canManageHabit(input),
        canComplete: canCompleteHabit(input),
        today: {
          date: today,
          isScheduled: this.isScheduledOn(habit, today),
          isCompleted: Boolean(completion),
          completionId: completion?.id ?? null,
          completedBy: completion ? this.completionActor(completion) : null,
          canUndo: Boolean(completion && completion.completedById === userId),
        },
        streak: effectiveStreak({
          stored: stored
            ? {
                currentStreak: stored.currentStreak,
                longestStreak: stored.longestStreak,
                lastCompletedDate: stored.lastCompletedDate
                  ? fromDbDate(stored.lastCompletedDate)
                  : null,
              }
            : null,
          scheduleDays,
          today,
          endDate: habit.endDate ? fromDbDate(habit.endDate) : null,
        }),
      };
    });
  }

  completionActor(c: CompletionWithActor): PersonRefDto {
    return this.person(c.completedBy.id, c.completedBy.profile);
  }

  private person(
    userId: string,
    profile: { displayName: string; avatarKey: string; photoUpdatedAt: Date | null } | null,
  ): PersonRefDto {
    return {
      userId,
      displayName: profile?.displayName ?? '—',
      avatarKey: profile?.avatarKey ?? 'fox',
      photoUrl: photoUrl(userId, profile?.photoUpdatedAt),
    };
  }

  /** Defaults to every member; otherwise every id must belong to the family. */
  private async resolveAssignees(familyId: string, requested?: string[]): Promise<string[]> {
    const members = await this.prisma.familyMember.findMany({
      where: { familyId },
      select: { userId: true },
    });
    const memberIds = new Set(members.map((m) => m.userId));
    if (!requested) return [...memberIds];
    const invalid = requested.filter((id) => !memberIds.has(id));
    if (invalid.length > 0) {
      throw AppException.badRequest(
        ErrorCode.INVALID_ASSIGNEES,
        'Зөвхөн гэр бүлийн гишүүдэд дадал онооно.',
        [{ field: 'assignedUserIds', errors: ['contains users outside the family'] }],
      );
    }
    return requested;
  }

  private assertDateRange(startDate: string, endDate: string | null, today: string): void {
    if (startDate < today) {
      throw this.dateOutOfRange('Эхлэх огноо өнөөдрөөс өмнө байж болохгүй.');
    }
    if (startDate > addDays(today, MAX_START_AHEAD_DAYS)) {
      throw this.dateOutOfRange('Эхлэх огноо хэт хол байна.');
    }
    if (endDate && endDate < startDate) {
      throw this.dateOutOfRange('Дуусах огноо эхлэх огнооноос өмнө байж болохгүй.');
    }
  }

  private assertCanManage(ctx: HabitContext): void {
    if (!ctx.canManage) {
      throw AppException.forbidden(ErrorCode.FORBIDDEN, 'Энэ дадлыг засах эрх танд алга.');
    }
  }

  private dateOutOfRange(message: string) {
    return new AppException(HttpStatus.UNPROCESSABLE_ENTITY, ErrorCode.DATE_OUT_OF_RANGE, message);
  }
}
