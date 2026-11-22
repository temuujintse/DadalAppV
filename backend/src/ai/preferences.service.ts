import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { AIPreferencesDto, UpdateAIPreferencesDto } from './dto/ai.dto';
import { cleanUserText } from './safety/guards';

/** The user's own AI settings (opt-out, goals, time budget, preferred difficulty). */
@Injectable()
export class AIPreferencesService {
  constructor(private readonly prisma: PrismaService) {}

  async get(userId: string): Promise<AIPreferencesDto> {
    const p = await this.prisma.aIUserPreference.findUnique({ where: { userId } });
    return {
      aiEnabled: p?.aiEnabled ?? true,
      goals: p?.goals ?? null,
      availableMinutesPerDay: p?.availableMinutesPerDay ?? null,
      preferredDifficulty: p?.preferredDifficulty ?? null,
    };
  }

  async update(userId: string, dto: UpdateAIPreferencesDto): Promise<AIPreferencesDto> {
    const data = {
      aiEnabled: dto.aiEnabled,
      goals: dto.goals === undefined ? undefined : dto.goals ? cleanUserText(dto.goals, 500) : null,
      availableMinutesPerDay: dto.availableMinutesPerDay,
      preferredDifficulty: dto.preferredDifficulty,
    };
    await this.prisma.aIUserPreference.upsert({
      where: { userId },
      create: { userId, ...data },
      update: data,
    });
    return this.get(userId);
  }
}
