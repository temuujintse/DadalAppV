import { HttpException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { z } from 'zod';
import { AppException } from '../common/errors/app.exception';
import { ErrorCode } from '../common/errors/error-codes';
import { isLocalDate } from '../common/utils/local-date';
import { CompletionsService } from '../completions/completions.service';
import type { Env } from '../config/env';
import { PrismaService } from '../database/prisma.service';
import { FamiliesService } from '../families/families.service';
import { FamilyAccessService } from '../families/family-access.service';
import { GamificationService } from '../gamification/gamification.service';
import { Prisma, SyncOperation } from '../generated/prisma/client';
import { SyncOperationStatus } from '../generated/prisma/enums';
import { HabitsService } from '../habits/habits.service';
import { PetsService } from '../pets/pets.service';
import {
  SyncOperationInputDto,
  SyncOperationResultDto,
  SyncPullDto,
  SyncPushResultDto,
  SyncStatusDto,
} from './dto/sync.dto';

const FINAL: SyncOperationStatus[] = ['PROCESSED', 'REJECTED', 'CONFLICT'];

/** Business "no" that the user should understand, not retry. */
const CONFLICT_CODES = new Set<string>([
  ErrorCode.ALREADY_COMPLETED,
  ErrorCode.CARE_COOLDOWN,
  ErrorCode.XP_ALREADY_SPENT,
  ErrorCode.UNDO_WINDOW_PASSED,
]);

const uuid = z.string().uuid();
const completionPayload = z.object({
  habitId: uuid,
  localDate: z.string().refine(isLocalDate, 'localDate must be YYYY-MM-DD'),
  idempotencyKey: uuid,
  note: z.string().max(280).optional(),
});
const undoPayload = z.object({ completionId: uuid });
const carePayload = z.object({
  type: z.enum(['PET', 'FEED', 'PLAY', 'BATH']),
  idempotencyKey: uuid,
});

interface Outcome {
  status: SyncOperationStatus;
  errorCode: string | null;
  message: string | null;
  data: Record<string, unknown> | null;
}

/**
 * Offline sync (spec ch. 10). Each operation is processed on its own — one bad operation never
 * blocks the rest (partial batch success). Every operation is recorded in SyncOperation; replaying
 * the same operationId returns the stored result. The real work goes through the normal online
 * services, so XP, streak, quest and idempotency rules are identical online and offline.
 */
@Injectable()
export class SyncService {
  private readonly logger = new Logger(SyncService.name);
  private readonly windowDays: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly completions: CompletionsService,
    private readonly pets: PetsService,
    private readonly habits: HabitsService,
    private readonly families: FamiliesService,
    private readonly access: FamilyAccessService,
    private readonly gamification: GamificationService,
    config: ConfigService<Env, true>,
  ) {
    this.windowDays = config.get('OFFLINE_SYNC_WINDOW_DAYS', { infer: true });
  }

  async push(userId: string, operations: SyncOperationInputDto[]): Promise<SyncPushResultDto> {
    const byId = new Map<string, SyncOperationResultDto>();
    // Sequential and in client time order on purpose: a completion and its later undo must apply
    // in the order they happened. Results come back in the order they were sent.
    const ordered = [...operations].sort(
      (a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt),
    );
    for (const op of ordered) {
      if (!byId.has(op.operationId)) byId.set(op.operationId, await this.processOne(userId, op));
    }
    return {
      serverTime: new Date().toISOString(),
      results: operations.map((op) => byId.get(op.operationId)!),
    };
  }

  async pull(userId: string): Promise<SyncPullDto> {
    const membership = await this.access.findMembership(userId);
    const [habits, gamification, family, members, pendingOperations] = await Promise.all([
      this.habits.list(userId, { scope: 'all', status: 'ACTIVE' }),
      this.gamification.getMe(userId),
      membership ? this.families.getCurrent(userId) : Promise.resolve(null),
      membership ? this.families.listMembers(userId) : Promise.resolve([]),
      this.prisma.syncOperation.count({
        where: { userId, status: { in: ['PENDING', 'FAILED'] } },
      }),
    ]);
    return {
      serverTime: new Date().toISOString(),
      habits,
      gamification,
      family,
      members,
      pendingOperations,
    };
  }

  async status(userId: string): Promise<SyncStatusDto> {
    const [groups, last, recent] = await Promise.all([
      this.prisma.syncOperation.groupBy({ by: ['status'], where: { userId }, _count: true }),
      this.prisma.syncOperation.aggregate({ where: { userId }, _max: { processedAt: true } }),
      this.prisma.syncOperation.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
    ]);
    return {
      serverTime: new Date().toISOString(),
      offlineWindowDays: this.windowDays,
      counts: Object.fromEntries(groups.map((g) => [g.status, g._count])),
      lastProcessedAt: last._max.processedAt?.toISOString() ?? null,
      recent: recent.map((r) => ({
        operationId: r.operationId,
        type: r.type,
        status: r.status,
        errorCode: r.errorCode,
        createdAt: r.createdAt.toISOString(),
        processedAt: r.processedAt?.toISOString() ?? null,
      })),
    };
  }

  // ───────────────────────────── Internals ─────────────────────────────

  private async processOne(
    userId: string,
    op: SyncOperationInputDto,
  ): Promise<SyncOperationResultDto> {
    const key = { userId_operationId: { userId, operationId: op.operationId } };
    const existing = await this.prisma.syncOperation.findUnique({ where: key });

    if (existing && FINAL.includes(existing.status)) return this.toResult(existing, true);
    if (existing && existing.type !== op.type) {
      return {
        operationId: op.operationId,
        type: op.type,
        status: 'REJECTED',
        errorCode: 'OPERATION_ID_REUSED',
        message: 'Энэ үйлдлийн дугаар өөр үйлдэлд ашиглагдсан байна.',
        replayed: false,
        data: null,
      };
    }
    const clientCreatedAt = new Date(op.createdAt);
    if (!existing) {
      await this.prisma.syncOperation.createMany({
        data: [
          {
            userId,
            operationId: op.operationId,
            type: op.type,
            payload: op.payload as Prisma.InputJsonValue,
            clientCreatedAt,
          },
        ],
        skipDuplicates: true,
      });
    }

    const outcome = await this.execute(userId, op, clientCreatedAt);
    const saved = await this.prisma.syncOperation.update({
      where: key,
      data: {
        status: outcome.status,
        errorCode: outcome.errorCode,
        result: { message: outcome.message, data: outcome.data } as Prisma.InputJsonValue,
        processedAt: FINAL.includes(outcome.status) ? new Date() : null,
      },
    });
    return this.toResult(saved, false);
  }

  private async execute(
    userId: string,
    op: SyncOperationInputDto,
    clientCreatedAt: Date,
  ): Promise<Outcome> {
    try {
      switch (op.type) {
        case 'HABIT_COMPLETION': {
          const p = this.parse(completionPayload, op.payload);
          const r = await this.completions.complete(
            userId,
            p.habitId,
            { idempotencyKey: p.idempotencyKey, localDate: p.localDate, note: p.note },
            { source: 'OFFLINE_SYNC', clientCreatedAt },
          );
          return this.ok({
            completionId: r.completion.id,
            habitId: p.habitId,
            localDate: r.completion.localDate,
            rewards: r.rewards,
            streak: r.streak,
            replayed: r.replayed,
          });
        }
        case 'COMPLETION_UNDO': {
          const p = this.parse(undoPayload, op.payload);
          const r = await this.completions.undo(userId, p.completionId);
          return this.ok({ habitId: r.habitId, rewards: r.rewards, streak: r.streak });
        }
        case 'PET_CARE': {
          const p = this.parse(carePayload, op.payload);
          const r = await this.pets.care(userId, p.type, p.idempotencyKey);
          return this.ok({
            petXP: r.petXP,
            happinessDelta: r.happinessDelta,
            replayed: r.replayed,
          });
        }
      }
    } catch (err) {
      if (err instanceof AppException) {
        return {
          status: CONFLICT_CODES.has(err.code) ? 'CONFLICT' : 'REJECTED',
          errorCode: err.code,
          message: err.message,
          data: (err.details as Record<string, unknown>) ?? null,
        };
      }
      if (err instanceof HttpException && err.getStatus() < 500) {
        return {
          status: 'REJECTED',
          errorCode: ErrorCode.BAD_REQUEST,
          message: err.message,
          data: null,
        };
      }
      // Unexpected (DB hiccup, timeout…): keep it retryable.
      this.logger.warn(`Sync operation ${op.operationId} failed: ${String(err)}`);
      return {
        status: 'FAILED',
        errorCode: ErrorCode.INTERNAL_ERROR,
        message: 'Түр алдаа гарлаа. Дахин оролдоно.',
        data: null,
      };
    }
  }

  private parse<T>(schema: z.ZodType<T>, payload: unknown): T {
    const r = schema.safeParse(payload);
    if (!r.success) {
      throw AppException.badRequest(
        ErrorCode.VALIDATION_ERROR,
        'Үйлдлийн өгөгдөл буруу байна.',
        r.error.issues.map((i) => ({ field: i.path.join('.'), errors: [i.message] })),
      );
    }
    return r.data;
  }

  private ok(data: Record<string, unknown>): Outcome {
    return { status: 'PROCESSED', errorCode: null, message: null, data };
  }

  private toResult(row: SyncOperation, replayed: boolean): SyncOperationResultDto {
    const result = (row.result ?? {}) as {
      message?: string | null;
      data?: Record<string, unknown> | null;
    };
    return {
      operationId: row.operationId,
      type: row.type,
      status: row.status,
      errorCode: row.errorCode,
      message: result.message ?? null,
      replayed,
      data: result.data ?? null,
    };
  }
}
