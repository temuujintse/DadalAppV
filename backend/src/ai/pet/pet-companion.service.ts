import { Injectable, Logger } from '@nestjs/common';
import { addDays, fromDbDate } from '../../common/utils/local-date';
import {
  DEFAULT_TIMEZONE,
  localDateString,
  zonedMidnightUtc,
} from '../../common/utils/timezone.util';
import { PrismaService } from '../../database/prisma.service';
import { ListHabitsQueryDto } from '../../habits/dto/habit.dto';
import { HabitsService } from '../../habits/habits.service';
import { AIOrchestrator } from '../ai-orchestrator.service';
import { PetInteractionDto } from '../dto/pet-ai.dto';
import { cleanUserText } from '../safety/guards';
import {
  AI_EVENTS,
  chooseEvent,
  PetEvent,
  PetMoment,
  templateFor,
  toAppAnimation,
} from './pet-rules';
import { PET_JSON_SCHEMA, petOutputSchema } from './pet.schemas';

/**
 * AI Pet Companion. Template-first: everyday events answer instantly from local templates; the
 * AI writes a message only for special moments, once per user/event/day, and any AI problem
 * (disabled, quota, outage) quietly falls back to a template. It never changes pet XP or level.
 */
@Injectable()
export class PetCompanionService {
  private readonly logger = new Logger(PetCompanionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ai: AIOrchestrator,
    private readonly habits: HabitsService,
  ) {}

  async interact(userId: string, requested?: PetEvent): Promise<PetInteractionDto> {
    const [pet, profile, membership] = await Promise.all([
      this.prisma.userPet.findUnique({ where: { userId } }),
      this.prisma.userProfile.findUnique({ where: { userId }, select: { timezone: true } }),
      this.prisma.familyMember.findUnique({ where: { userId }, select: { role: true } }),
    ]);
    const tz = profile?.timezone ?? DEFAULT_TIMEZONE;
    const today = localDateString(tz);
    const moment = await this.moment(userId, pet?.name ?? 'Бамбаа', today);
    const event = requested ?? chooseEvent(moment);
    const seed = hash(`${today}:${event}`);

    if (!pet || !AI_EVENTS.has(event)) return template(event, moment, seed);

    // Special moment: reuse today's message if we already wrote one.
    const since = zonedMidnightUtc(today, tz);
    const cached = await this.prisma.aIPetInteraction.findFirst({
      where: { userId, event, createdAt: { gte: since } },
      orderBy: { createdAt: 'desc' },
    });
    if (cached) {
      return {
        event,
        message: cached.message,
        emotion: cached.emotion,
        animation: cached.animation,
        suggestedAction: cached.suggestedAction,
        source: cached.source,
      };
    }

    let result: PetInteractionDto;
    try {
      const out = await this.ai.run(
        userId,
        'PET',
        {
          instructions: petInstructions(membership?.role === 'CHILD'),
          input: [
            {
              role: 'user',
              content: `Event context (computed by the app, trusted):\n${JSON.stringify({
                event,
                petName: cleanUserText(moment.petName, 30),
                petSpecies: pet.species,
                petLevel: pet.level,
                petHappiness: pet.happiness,
                bestCurrentStreak: moment.bestCurrentStreak,
                doneToday: moment.doneToday,
                dueToday: moment.dueToday,
                daysSinceLastCompletion: moment.daysSinceLastCompletion,
              })}`,
            },
          ],
          schemaName: 'pet_message',
          schema: PET_JSON_SCHEMA,
          maxOutputTokens: 200,
        },
        (data) => petOutputSchema.parse(data),
        (r) => [r.message],
      );
      result = {
        event,
        message: out.message,
        emotion: out.emotion,
        animation: toAppAnimation(out.animation),
        suggestedAction: out.suggestedAction,
        source: 'AI',
      };
    } catch (err) {
      this.logger.debug(`Pet AI fallback (${event}): ${String(err)}`);
      result = template(event, moment, seed);
    }

    await this.prisma.aIPetInteraction.create({
      data: { userId, petId: pet.id, ...result },
    });
    return result;
  }

  private async moment(userId: string, petName: string, today: string): Promise<PetMoment> {
    const [habits, stats, streak] = await Promise.all([
      this.habits.list(
        userId,
        Object.assign(new ListHabitsQueryDto(), { scope: 'today', status: 'ACTIVE' }),
      ),
      this.prisma.userGamification.findUnique({
        where: { userId },
        select: { lastCompletionDate: true },
      }),
      this.prisma.habitStreak.aggregate({ where: { userId }, _max: { currentStreak: true } }),
    ]);
    const due = habits.filter((h) => h.canComplete && h.today.isScheduled);
    const last = stats?.lastCompletionDate ? fromDbDate(stats.lastCompletionDate) : null;
    let daysSince: number | null = null;
    if (last) {
      daysSince = 0;
      for (let d = last; d < today && daysSince < 60; d = addDays(d, 1)) daysSince++;
    }
    return {
      petName,
      dueToday: due.length,
      doneToday: due.filter((h) => h.today.isCompleted).length,
      bestCurrentStreak: streak._max.currentStreak ?? 0,
      daysSinceLastCompletion: daysSince,
      completedToday: last === today,
    };
  }
}

function template(event: PetEvent, m: PetMoment, seed: number): PetInteractionDto {
  const t = templateFor(event, m, seed);
  return {
    event,
    message: t.message,
    emotion: t.emotion,
    animation: toAppAnimation(t.animation),
    suggestedAction: t.suggestedAction,
    source: 'TEMPLATE',
  };
}

function petInstructions(child: boolean): string {
  return `You are the user's pet in "Family Habit", speaking in first person.
Write ONE short, warm message in Mongolian (Cyrillic), max 120 characters, with at most one emoji.
${child ? 'The user is a child: very simple, playful words.' : 'Keep it friendly and light.'}
Celebrate effort; never blame, guilt-trip or punish inactivity. Do not mention XP numbers or
change anything — you only cheer. No links, contacts, medical or diet advice.
Pick emotion, animation and suggestedAction from the allowed values to match the event.`;
}

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return h;
}
