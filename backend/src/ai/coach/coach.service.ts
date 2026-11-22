import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuditAction, AuditService } from '../../common/audit/audit.service';
import { AppException } from '../../common/errors/app.exception';
import { ErrorCode } from '../../common/errors/error-codes';
import type { Env } from '../../config/env';
import { PrismaService } from '../../database/prisma.service';
import { AIMessage, AIRecommendation } from '../../generated/prisma/client';
import { HabitsService } from '../../habits/habits.service';
import { AIOrchestrator } from '../ai-orchestrator.service';
import { CoachContextService } from '../context/coach-context.service';
import {
  AcceptRecommendationDto,
  AcceptResultDto,
  AIMessageDto,
  ChatRequestDto,
  ChatResultDto,
  ConversationDto,
  ConversationSummaryDto,
  RecommendationDto,
  RecommendRequestDto,
} from '../dto/ai.dto';
import { cleanUserText, looksLikeInjection, untrusted } from '../safety/guards';
import { chatInstructions, contextBlock, recommendInstructions } from './coach.prompts';
import {
  CHAT_JSON_SCHEMA,
  chatSchema,
  normalizeSchedule,
  RECOMMENDATIONS_JSON_SCHEMA,
  RecommendationPayload,
  recommendationSchema,
  recommendationsSchema,
} from './coach.schemas';

const RECOMMENDATION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_RECOMMENDATIONS = 3;
const HISTORY_TURNS = 10;

/**
 * AI Habit Coach. The model only proposes: proposals are stored as PENDING and become a real
 * habit only when the user accepts, through HabitsService (same validation as manual habits).
 */
@Injectable()
export class CoachService {
  private readonly logger = new Logger(CoachService.name);
  private readonly retentionDays: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly ai: AIOrchestrator,
    private readonly context: CoachContextService,
    private readonly habits: HabitsService,
    private readonly audit: AuditService,
    config: ConfigService<Env, true>,
  ) {
    this.retentionDays = config.get('AI_CONVERSATION_RETENTION_DAYS', { infer: true });
  }

  // ───────────── Recommendations ─────────────

  async recommend(userId: string, dto: RecommendRequestDto): Promise<RecommendationDto[]> {
    const replay = await this.byRequest(userId, dto.idempotencyKey);
    if (replay.length) return replay.map(toDto);

    const goal = cleanUserText(dto.goal, 500);
    if (!goal) throw AppException.badRequest(ErrorCode.VALIDATION_ERROR, 'Зорилгоо бичнэ үү.');
    if (looksLikeInjection(goal)) this.logger.warn(`Possible prompt injection (user ${userId})`);

    const ctx = await this.context.build(userId);
    const taken = new Set(
      [...ctx.activeHabits.map((h) => h.title), ...ctx.recentlyRejected].map(norm),
    );
    const proposals = await this.ai.run(
      userId,
      'COACH_RECOMMEND',
      {
        instructions: recommendInstructions(ctx),
        input: [
          { role: 'user', content: `${contextBlock(ctx)}\n\n${untrusted('USER_GOAL', goal)}` },
        ],
        schemaName: 'habit_recommendations',
        schema: RECOMMENDATIONS_JSON_SCHEMA,
        maxOutputTokens: 1_000,
      },
      (data) => validateProposals(data, taken),
      (list) => list.flatMap((p) => [p.title, p.description, p.reason, p.expectedBenefit]),
    );
    if (!proposals.length) {
      throw new AppException(
        HttpStatus.UNPROCESSABLE_ENTITY,
        ErrorCode.AI_REFUSED,
        'Энэ зорилгод тохирох шинэ дадал олдсонгүй. Зорилгоо өөрөөр бичээд үзээрэй.',
      );
    }

    const expiresAt = new Date(Date.now() + RECOMMENDATION_TTL_MS);
    await this.prisma.aIRecommendation.createMany({
      data: proposals.map((p, position) => ({
        userId,
        requestKey: dto.idempotencyKey,
        position,
        goal,
        payload: p,
        expiresAt,
      })),
      skipDuplicates: true, // a concurrent retry with the same key wrote them first
    });
    return (await this.byRequest(userId, dto.idempotencyKey)).map(toDto);
  }

  async list(
    userId: string,
    status: RecommendationDto['status'] = 'PENDING',
  ): Promise<RecommendationDto[]> {
    await this.expireOld(userId);
    const rows = await this.prisma.aIRecommendation.findMany({
      where: { userId, status },
      orderBy: [{ createdAt: 'desc' }, { position: 'asc' }],
      take: 30,
    });
    return rows.map(toDto);
  }

  async accept(userId: string, id: string, dto: AcceptRecommendationDto): Promise<AcceptResultDto> {
    const rec = await this.owned(userId, id);
    if (rec.status === 'ACCEPTED' && rec.createdHabitId) {
      return {
        recommendation: toDto(rec),
        habit: await this.habits.getDetail(userId, rec.createdHabitId),
      };
    }
    this.assertPending(rec);

    // Claim first so two taps cannot create two habits.
    const claimed = await this.prisma.aIRecommendation.updateMany({
      where: { id, userId, status: 'PENDING' },
      data: { status: 'ACCEPTED', decidedAt: new Date() },
    });
    if (claimed.count !== 1) return this.accept(userId, id, dto);

    const p = rec.payload as unknown as RecommendationPayload;
    let habitId: string;
    try {
      const habit = await this.habits.create(userId, {
        title: dto.title?.trim() || p.title,
        description: p.description,
        icon: p.icon,
        type: 'PERSONAL',
        difficulty: p.difficulty,
        scheduleDays: dto.scheduleDays ?? p.scheduleDays,
        reminderTime: dto.reminderTime,
      });
      habitId = habit.id;
    } catch (err) {
      // Release the claim: the user can fix the input and try again.
      await this.prisma.aIRecommendation.update({
        where: { id },
        data: { status: 'PENDING', decidedAt: null },
      });
      throw err;
    }
    const updated = await this.prisma.aIRecommendation.update({
      where: { id },
      data: { createdHabitId: habitId },
    });
    await this.audit.record({
      action: AuditAction.AI_RECOMMENDATION_ACCEPTED,
      entityType: 'AIRecommendation',
      entityId: id,
      actorId: userId,
      metadata: { habitId },
    });
    return { recommendation: toDto(updated), habit: await this.habits.getDetail(userId, habitId) };
  }

  async reject(userId: string, id: string, reason?: string): Promise<RecommendationDto> {
    const rec = await this.owned(userId, id);
    if (rec.status === 'REJECTED') return toDto(rec);
    this.assertPending(rec);
    const claimed = await this.prisma.aIRecommendation.updateMany({
      where: { id, userId, status: 'PENDING' },
      data: { status: 'REJECTED', decidedAt: new Date() },
    });
    if (claimed.count !== 1) return this.reject(userId, id, reason);
    await this.prisma.aIRecommendationFeedback.create({
      data: { recommendationId: id, reason: reason ? cleanUserText(reason, 300) : null },
    });
    await this.audit.record({
      action: AuditAction.AI_RECOMMENDATION_REJECTED,
      entityType: 'AIRecommendation',
      entityId: id,
      actorId: userId,
    });
    return toDto(await this.owned(userId, id));
  }

  // ───────────── Chat ─────────────

  async chat(userId: string, dto: ChatRequestDto): Promise<ChatResultDto> {
    const conversation = dto.conversationId
      ? await this.ownedConversation(userId, dto.conversationId)
      : null;

    if (conversation) {
      const replay = await this.replayTurn(conversation.id, dto.clientKey);
      if (replay) return replay;
    }

    const message = cleanUserText(dto.message, 1000);
    if (!message) throw AppException.badRequest(ErrorCode.VALIDATION_ERROR, 'Мессежээ бичнэ үү.');
    if (looksLikeInjection(message)) this.logger.warn(`Possible prompt injection (user ${userId})`);

    const history = conversation
      ? await this.prisma.aIMessage.findMany({
          where: { conversationId: conversation.id },
          orderBy: { createdAt: 'desc' },
          take: HISTORY_TURNS,
        })
      : [];
    const ctx = await this.context.build(userId);
    const { reply } = await this.ai.run(
      userId,
      'COACH_CHAT',
      {
        instructions: chatInstructions(ctx),
        input: [
          { role: 'user', content: contextBlock(ctx) },
          ...history
            .reverse()
            .map((m) =>
              m.role === 'USER'
                ? { role: 'user' as const, content: untrusted('USER_MESSAGE', m.content) }
                : { role: 'assistant' as const, content: m.content },
            ),
          { role: 'user', content: untrusted('USER_MESSAGE', message) },
        ],
        schemaName: 'coach_reply',
        schema: CHAT_JSON_SCHEMA,
        maxOutputTokens: 600,
      },
      (data) => chatSchema.parse(data),
      (r) => [r.reply],
    );

    const now = new Date();
    const result = await this.prisma.$transaction(async (tx) => {
      const conv =
        conversation ??
        (await tx.aIConversation.create({
          data: { userId, title: titleFrom(message), lastMessageAt: now },
        }));
      const userMessage = await tx.aIMessage.create({
        data: {
          conversationId: conv.id,
          role: 'USER',
          content: message,
          clientKey: dto.clientKey,
          createdAt: now,
        },
      });
      const assistantMessage = await tx.aIMessage.create({
        data: {
          conversationId: conv.id,
          role: 'ASSISTANT',
          content: reply,
          structured: { reply },
          createdAt: new Date(now.getTime() + 1),
        },
      });
      await tx.aIConversation.update({ where: { id: conv.id }, data: { lastMessageAt: now } });
      return { conversationId: conv.id, userMessage, assistantMessage };
    });
    return {
      conversationId: result.conversationId,
      userMessage: messageDto(result.userMessage),
      assistantMessage: messageDto(result.assistantMessage),
    };
  }

  async conversations(userId: string): Promise<ConversationSummaryDto[]> {
    await this.purgeExpired(userId);
    const rows = await this.prisma.aIConversation.findMany({
      where: { userId },
      orderBy: { lastMessageAt: 'desc' },
      take: 50,
    });
    return rows.map((c) => ({
      id: c.id,
      title: c.title,
      lastMessageAt: c.lastMessageAt.toISOString(),
      createdAt: c.createdAt.toISOString(),
    }));
  }

  async conversation(userId: string, id: string): Promise<ConversationDto> {
    const c = await this.ownedConversation(userId, id);
    const messages = await this.prisma.aIMessage.findMany({
      where: { conversationId: id },
      orderBy: { createdAt: 'asc' },
    });
    return {
      id: c.id,
      title: c.title,
      lastMessageAt: c.lastMessageAt.toISOString(),
      createdAt: c.createdAt.toISOString(),
      messages: messages.map(messageDto),
    };
  }

  async deleteConversation(userId: string, id: string): Promise<void> {
    await this.ownedConversation(userId, id);
    await this.prisma.aIConversation.delete({ where: { id } });
  }

  // ───────────── Internals ─────────────

  private byRequest(userId: string, requestKey: string): Promise<AIRecommendation[]> {
    return this.prisma.aIRecommendation.findMany({
      where: { userId, requestKey },
      orderBy: { position: 'asc' },
    });
  }

  /** Other users' records look exactly like missing ones. */
  private async owned(userId: string, id: string): Promise<AIRecommendation> {
    const rec = await this.prisma.aIRecommendation.findFirst({ where: { id, userId } });
    if (!rec) throw AppException.notFound(ErrorCode.RECOMMENDATION_NOT_FOUND, 'Санал олдсонгүй.');
    return rec;
  }

  private assertPending(rec: AIRecommendation): void {
    if (rec.status === 'PENDING' && rec.expiresAt.getTime() <= Date.now()) {
      void this.prisma.aIRecommendation.updateMany({
        where: { id: rec.id, status: 'PENDING' },
        data: { status: 'EXPIRED' },
      });
      throw AppException.gone(
        ErrorCode.RECOMMENDATION_EXPIRED,
        'Саналын хугацаа дууссан байна. Шинэ санал аваарай.',
      );
    }
    if (rec.status !== 'PENDING') {
      throw AppException.conflict(
        ErrorCode.RECOMMENDATION_DECIDED,
        'Энэ саналын талаар аль хэдийн шийдвэр гаргасан байна.',
      );
    }
  }

  private expireOld(userId: string) {
    return this.prisma.aIRecommendation.updateMany({
      where: { userId, status: 'PENDING', expiresAt: { lte: new Date() } },
      data: { status: 'EXPIRED' },
    });
  }

  private async ownedConversation(userId: string, id: string) {
    const c = await this.prisma.aIConversation.findFirst({ where: { id, userId } });
    if (!c) throw AppException.notFound(ErrorCode.CONVERSATION_NOT_FOUND, 'Яриа олдсонгүй.');
    return c;
  }

  private async replayTurn(
    conversationId: string,
    clientKey: string,
  ): Promise<ChatResultDto | null> {
    const userMessage = await this.prisma.aIMessage.findUnique({
      where: { conversationId_clientKey: { conversationId, clientKey } },
    });
    if (!userMessage) return null;
    const assistantMessage = await this.prisma.aIMessage.findFirst({
      where: { conversationId, role: 'ASSISTANT', createdAt: { gt: userMessage.createdAt } },
      orderBy: { createdAt: 'asc' },
    });
    if (!assistantMessage) return null;
    return {
      conversationId,
      userMessage: messageDto(userMessage),
      assistantMessage: messageDto(assistantMessage),
    };
  }

  /** Data retention: conversations idle longer than AI_CONVERSATION_RETENTION_DAYS are deleted. */
  private purgeExpired(userId: string) {
    const cutoff = new Date(Date.now() - this.retentionDays * 24 * 60 * 60 * 1000);
    return this.prisma.aIConversation.deleteMany({
      where: { userId, lastMessageAt: { lt: cutoff } },
    });
  }
}

// ───────────── Pure helpers (unit tested) ─────────────

function norm(title: string): string {
  return title.trim().toLocaleLowerCase('mn').replace(/\s+/g, ' ');
}

/** Schema + business validation; drops invalid, duplicate or already-taken proposals. */
export function validateProposals(data: unknown, taken: Set<string>): RecommendationPayload[] {
  const { recommendations } = recommendationsSchema.parse(data);
  const out: RecommendationPayload[] = [];
  const seen = new Set(taken);
  for (const raw of recommendations) {
    const parsed = recommendationSchema.safeParse(raw);
    if (!parsed.success) continue;
    const p = normalizeSchedule(parsed.data);
    if (!p || seen.has(norm(p.title))) continue;
    seen.add(norm(p.title));
    out.push(p);
    if (out.length === MAX_RECOMMENDATIONS) break;
  }
  return out;
}

function titleFrom(message: string): string {
  const oneLine = message.replace(/\s+/g, ' ').trim();
  return oneLine.length > 60 ? `${oneLine.slice(0, 57)}…` : oneLine;
}

function toDto(r: AIRecommendation): RecommendationDto {
  return {
    id: r.id,
    status: r.status,
    goal: r.goal,
    proposal: r.payload as unknown as RecommendationDto['proposal'],
    createdHabitId: r.createdHabitId,
    expiresAt: r.expiresAt.toISOString(),
    createdAt: r.createdAt.toISOString(),
  };
}

function messageDto(m: AIMessage): AIMessageDto {
  return { id: m.id, role: m.role, content: m.content, createdAt: m.createdAt.toISOString() };
}
