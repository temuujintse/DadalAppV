import { HttpStatus, Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppException } from '../common/errors/app.exception';
import { ErrorCode } from '../common/errors/error-codes';
import { DEFAULT_TIMEZONE, localDateString, zonedMidnightUtc } from '../common/utils/timezone.util';
import type { Env } from '../config/env';
import { PrismaService } from '../database/prisma.service';
import { AIFeature } from '../generated/prisma/enums';
import {
  AI_PROVIDER,
  AIProvider,
  AIProviderError,
  AIRequest,
  AIUsage,
} from './ai-provider.interface';
import { estimateTokens, outputViolations } from './safety/guards';

export type AIUnavailableReason = 'NOT_CONFIGURED' | 'DISABLED' | 'USER_DISABLED';

export interface AIStatus {
  enabled: boolean;
  reason: AIUnavailableReason | null;
  dailyLimit: number;
  usedToday: number;
  remainingToday: number;
}

/**
 * Single entry point for every AI call: availability, daily quota, token limits, provider call,
 * runtime validation, output safety, usage accounting (no prompts stored) and error mapping to
 * friendly Mongolian messages. Business features build prompts and handle results only.
 */
@Injectable()
export class AIOrchestrator {
  private readonly logger = new Logger(AIOrchestrator.name);
  private readonly enabled: boolean;
  private readonly dailyLimit: number;
  private readonly maxInputTokens: number;
  private readonly maxOutputTokens: number;

  constructor(
    private readonly prisma: PrismaService,
    @Inject(AI_PROVIDER) private readonly provider: AIProvider,
    config: ConfigService<Env, true>,
  ) {
    this.enabled = config.get('AI_ENABLED', { infer: true });
    this.dailyLimit = config.get('AI_DAILY_USER_LIMIT', { infer: true });
    this.maxInputTokens = config.get('AI_MAX_INPUT_TOKENS', { infer: true });
    this.maxOutputTokens = config.get('AI_MAX_OUTPUT_TOKENS', { infer: true });
  }

  async status(userId: string): Promise<AIStatus> {
    const [reason, usedToday] = await Promise.all([
      this.unavailableReason(userId),
      this.usedToday(userId),
    ]);
    return {
      enabled: reason === null,
      reason,
      dailyLimit: this.dailyLimit,
      usedToday,
      remainingToday: Math.max(0, this.dailyLimit - usedToday),
    };
  }

  /**
   * Runs one structured AI call. `validate` must throw on output that breaks the contract;
   * `texts` returns the user-visible strings to safety-check.
   */
  async run<T>(
    userId: string,
    feature: AIFeature,
    request: AIRequest,
    validate: (data: unknown) => T,
    texts: (result: T) => string[],
  ): Promise<T> {
    const reason = await this.unavailableReason(userId);
    if (reason) throw this.disabled(reason);
    if ((await this.usedToday(userId)) >= this.dailyLimit) {
      throw new AppException(
        HttpStatus.TOO_MANY_REQUESTS,
        ErrorCode.AI_QUOTA_EXCEEDED,
        `Өнөөдрийн AI хүсэлтийн хязгаар (${this.dailyLimit}) дууслаа. Маргааш дахин оролдоорой.`,
      );
    }
    const promptTokens = estimateTokens(
      request.instructions + request.input.map((m) => m.content).join('\n'),
    );
    if (promptTokens > this.maxInputTokens) {
      throw AppException.badRequest(
        ErrorCode.BAD_REQUEST,
        'Хүсэлт хэт урт байна. Товчилж бичнэ үү.',
      );
    }

    const started = Date.now();
    const log = (
      status: 'SUCCESS' | 'ERROR',
      usage?: AIUsage,
      errorCode?: string,
      requestId?: string,
    ) =>
      this.prisma.aIUsageLog
        .create({
          data: {
            userId,
            provider: this.provider.name,
            model: this.provider.model,
            feature,
            inputTokens: usage?.inputTokens ?? 0,
            outputTokens: usage?.outputTokens ?? 0,
            totalTokens: usage?.totalTokens ?? 0,
            latencyMs: Date.now() - started,
            status,
            errorCode: errorCode ?? null,
            requestId: requestId ?? null,
          },
        })
        .catch((err: unknown) => this.logger.warn(`Usage log failed: ${String(err)}`));

    let result;
    try {
      result = await this.provider.generate({
        ...request,
        maxOutputTokens: Math.min(request.maxOutputTokens, this.maxOutputTokens),
      });
    } catch (err) {
      const kind = err instanceof AIProviderError ? err.kind : 'UNAVAILABLE';
      await log(
        'ERROR',
        undefined,
        kind,
        err instanceof AIProviderError ? err.requestId : undefined,
      );
      throw this.mapProviderError(err);
    }

    let value: T;
    try {
      value = validate(result.data);
      const bad = texts(value).flatMap(outputViolations);
      if (bad.length) throw new Error(`Unsafe output: ${bad.join(',')}`);
    } catch (err) {
      this.logger.warn(`AI output rejected (${feature}): ${String(err)}`);
      await log('ERROR', result.usage, 'INVALID_OUTPUT', result.requestId);
      throw new AppException(
        HttpStatus.BAD_GATEWAY,
        ErrorCode.AI_BAD_OUTPUT,
        'AI ойлгомжгүй хариу өглөө. Дахин оролдоно уу.',
      );
    }
    await log('SUCCESS', result.usage, undefined, result.requestId);
    return value;
  }

  // ───────────── Internals ─────────────

  private async unavailableReason(userId: string): Promise<AIUnavailableReason | null> {
    if (!this.enabled) return 'DISABLED';
    if (!this.provider.configured) return 'NOT_CONFIGURED';
    const pref = await this.prisma.aIUserPreference.findUnique({
      where: { userId },
      select: { aiEnabled: true },
    });
    return pref && !pref.aiEnabled ? 'USER_DISABLED' : null;
  }

  /** Calls made since local midnight in the user's timezone (errors count too). */
  private async usedToday(userId: string): Promise<number> {
    const profile = await this.prisma.userProfile.findUnique({
      where: { userId },
      select: { timezone: true },
    });
    const tz = profile?.timezone ?? DEFAULT_TIMEZONE;
    const since = zonedMidnightUtc(localDateString(tz), tz);
    return this.prisma.aIUsageLog.count({ where: { userId, createdAt: { gte: since } } });
  }

  private disabled(reason: AIUnavailableReason): AppException {
    const message =
      reason === 'USER_DISABLED'
        ? 'AI туслахыг тохиргооноос унтраасан байна.'
        : 'AI туслах одоогоор идэвхгүй байна. Аппын бусад хэсэг хэвийн ажиллана.';
    return new AppException(HttpStatus.SERVICE_UNAVAILABLE, ErrorCode.AI_DISABLED, message);
  }

  private mapProviderError(err: unknown): AppException {
    const kind = err instanceof AIProviderError ? err.kind : 'UNAVAILABLE';
    switch (kind) {
      case 'REFUSAL':
        return new AppException(
          HttpStatus.UNPROCESSABLE_ENTITY,
          ErrorCode.AI_REFUSED,
          'Энэ хүсэлтэд AI хариулах боломжгүй. Өөрөөр асууж үзээрэй.',
        );
      case 'INVALID_OUTPUT':
      case 'EMPTY':
        return new AppException(
          HttpStatus.BAD_GATEWAY,
          ErrorCode.AI_BAD_OUTPUT,
          'AI ойлгомжгүй хариу өглөө. Дахин оролдоно уу.',
        );
      case 'AUTH':
      case 'BAD_MODEL':
        this.logger.error(`AI provider misconfigured: ${String(err)}`);
        return this.disabled('NOT_CONFIGURED');
      default:
        return new AppException(
          HttpStatus.SERVICE_UNAVAILABLE,
          ErrorCode.AI_UNAVAILABLE,
          'AI түр ажиллахгүй байна. Түр хүлээгээд дахин оролдоно уу.',
        );
    }
  }
}
