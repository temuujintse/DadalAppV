import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  AchievementUnlockDto,
  LevelStateDto,
  RewardsDto,
} from '../../gamification/dto/gamification.dto';
import {
  QuestGoalType,
  QuestPeriod,
  QuestProgressStatus,
  QuestScope,
} from '../../generated/prisma/enums';
import { PersonRefDto } from '../../common/dto/person-ref.dto';

export class QuestDto {
  id: string;
  key: string | null;
  title: string;
  description: string;
  icon: string;
  @ApiProperty({ enum: QuestPeriod, enumName: 'QuestPeriod' })
  period: QuestPeriod;
  @ApiProperty({ enum: QuestScope, enumName: 'QuestScope' })
  scope: QuestScope;
  @ApiProperty({ enum: QuestGoalType, enumName: 'QuestGoalType' })
  goalType: QuestGoalType;
  target: number;
  /** Current value, capped at target */
  progress: number;
  @ApiProperty({ enum: QuestProgressStatus, enumName: 'QuestProgressStatus' })
  status: QuestProgressStatus;
  /** Personal XP for the claimer */
  xpReward: number;
  /** Family XP (family quests) */
  familyXpReward: number;
  periodKey: string;
  /** ISO time the quest resets */
  resetsAt: string;
  claimedAt: string | null;
  @ApiPropertyOptional({ type: PersonRefDto, nullable: true })
  claimedBy: PersonRefDto | null;
}

export class QuestCompletedDto {
  id: string;
  title: string;
  @ApiProperty({ enum: QuestScope, enumName: 'QuestScope' })
  scope: QuestScope;
}

export class ClaimResultDto {
  quest: QuestDto;
  rewards: RewardsDto;
  gamification: LevelStateDto;
  @ApiPropertyOptional({ type: LevelStateDto, nullable: true })
  family: LevelStateDto | null;
  @ApiProperty({ type: [AchievementUnlockDto] })
  achievementsUnlocked: AchievementUnlockDto[];
}
