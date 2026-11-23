import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';
import {
  AchievementCondition,
  FamilyRole,
  XPSourceType,
  XPTransactionKind,
} from '../../generated/prisma/enums';

export class LevelStateDto {
  level: number;
  lifetimeXP: number;
  /** Spendable XP (personal wallet) */
  balanceXP: number;
  xpIntoLevel: number;
  xpForNextLevel: number;
  /** true when this request raised the level */
  leveledUp: boolean;
}

export class RewardsDto {
  personalXP: number;
  familyXP: number;
  petXP: number;
}

export class AchievementUnlockDto {
  id: string;
  key: string;
  title: string;
  description: string;
  icon: string;
  xpReward: number;
}

export class MyGamificationDto {
  level: number;
  lifetimeXP: number;
  balanceXP: number;
  xpIntoLevel: number;
  xpForNextLevel: number;
  totalCompletions: number;
  completionDays: number;
  /** Best streak still alive today */
  bestStreak: number;
  achievementsUnlocked: number;
  achievementsTotal: number;
}

export class FamilyGamificationDto {
  familyId: string;
  name: string;
  avatarKey: string;
  level: number;
  lifetimeXP: number;
  xpIntoLevel: number;
  xpForNextLevel: number;
  questsCompleted: number;
  /** Family XP earned since Monday (family timezone) */
  weekXP: number;
  leaderboardEnabled: boolean;
}

export class XpTransactionDto {
  id: string;
  @ApiProperty({ enum: XPTransactionKind, enumName: 'XPTransactionKind' })
  kind: XPTransactionKind;
  amount: number;
  @ApiProperty({ enum: XPSourceType, enumName: 'XPSourceType' })
  sourceType: XPSourceType;
  /** Human-readable Mongolian label */
  title: string;
  createdAt: string;
}

export const LEADERBOARD_PERIODS = ['week', 'month', 'all'] as const;
export type LeaderboardPeriod = (typeof LEADERBOARD_PERIODS)[number];

export class LeaderboardQueryDto {
  @ApiPropertyOptional({ enum: LEADERBOARD_PERIODS, default: 'week' })
  @IsOptional()
  @IsIn(LEADERBOARD_PERIODS)
  period: LeaderboardPeriod = 'week';
}

export class LeaderboardEntryDto {
  rank: number;
  userId: string;
  displayName: string;
  avatarKey: string;
  photoUrl: string | null;
  @ApiProperty({ enum: FamilyRole, enumName: 'FamilyRole' })
  role: FamilyRole;
  /** Personal XP earned in the period (reversals subtracted, rewards spending ignored) */
  xp: number;
  level: number;
  isMe: boolean;
}

export class LeaderboardDto {
  @ApiProperty({ enum: LEADERBOARD_PERIODS })
  period: LeaderboardPeriod;
  /** false when the family turned the leaderboard off */
  enabled: boolean;
  startsAt: string | null;
  @ApiProperty({ type: [LeaderboardEntryDto] })
  entries: LeaderboardEntryDto[];
}

export class AchievementDto {
  id: string;
  key: string;
  title: string;
  description: string;
  icon: string;
  xpReward: number;
  @ApiProperty({ enum: AchievementCondition, enumName: 'AchievementCondition' })
  condition: AchievementCondition;
  threshold: number;
  /** Current value of the measured metric (capped at threshold) */
  progress: number;
  unlockedAt: string | null;
}

export class TransactionsQueryDto {
  @ApiPropertyOptional({ minimum: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @ApiPropertyOptional({ minimum: 1, maximum: 100, default: 30 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 30;
}
