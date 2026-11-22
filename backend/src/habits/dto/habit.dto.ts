import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsDefined,
  IsEnum,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  registerDecorator,
  ValidateIf,
  ValidationOptions,
} from 'class-validator';
import { HABIT_COLORS, HABIT_ICON_KEYS } from '../../common/constants';
import { PersonRefDto } from '../../common/dto/person-ref.dto';
import {
  AchievementUnlockDto,
  LevelStateDto,
  RewardsDto,
} from '../../gamification/dto/gamification.dto';
import { AccessoryUnlockDto, PetProgressDto } from '../../pets/dto/pet.dto';
import { QuestCompletedDto } from '../../quests/dto/quest.dto';
import { isLocalDate } from '../../common/utils/local-date';
import { Trim } from '../../common/validation';
import {
  HabitCompletionMode,
  HabitDifficulty,
  HabitStatus,
  HabitType,
} from '../../generated/prisma/enums';

export function IsLocalDateString(options?: ValidationOptions) {
  return (object: object, propertyName: string) =>
    registerDecorator({
      name: 'isLocalDateString',
      target: object.constructor,
      propertyName,
      options: { message: `${propertyName} must be a date in YYYY-MM-DD format`, ...options },
      validator: { validate: (v: unknown) => typeof v === 'string' && isLocalDate(v) },
    });
}

class ScheduleDaysField {
  @ApiProperty({
    type: [Number],
    example: [1, 2, 3, 4, 5],
    description: 'Weekdays: 0 = Sunday … 6 = Saturday',
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(7)
  @ArrayUnique()
  @IsInt({ each: true })
  @Min(0, { each: true })
  @Max(6, { each: true })
  scheduleDays: number[];
}

/** 00:00–23:59 */
const REMINDER_TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

export class CreateHabitDto extends ScheduleDaysField {
  @ApiProperty({ example: 'Өглөө 20 минут алхах', maxLength: 80 })
  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  title: string;

  @ApiPropertyOptional({ maxLength: 500 })
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({ enum: HABIT_ICON_KEYS, default: 'sparkles' })
  @IsOptional()
  @IsIn(HABIT_ICON_KEYS)
  icon?: (typeof HABIT_ICON_KEYS)[number];

  @ApiPropertyOptional({ enum: HABIT_COLORS, default: '#F97316' })
  @IsOptional()
  @IsIn(HABIT_COLORS)
  color?: (typeof HABIT_COLORS)[number];

  @ApiProperty({ enum: HabitType, enumName: 'HabitType' })
  @IsEnum(HabitType)
  type: HabitType;

  @ApiPropertyOptional({
    enum: HabitCompletionMode,
    enumName: 'HabitCompletionMode',
    description: 'Required for FAMILY habits, must be omitted for PERSONAL.',
  })
  @ValidateIf((o: CreateHabitDto) => o.type === HabitType.FAMILY || o.completionMode !== undefined)
  @IsDefined()
  @IsEnum(HabitCompletionMode)
  completionMode?: HabitCompletionMode;

  @ApiPropertyOptional({ enum: HabitDifficulty, enumName: 'HabitDifficulty', default: 'EASY' })
  @IsOptional()
  @IsEnum(HabitDifficulty)
  difficulty?: HabitDifficulty;

  @ApiPropertyOptional({
    type: [String],
    description: 'FAMILY only. Defaults to every current family member.',
  })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(200)
  @ArrayUnique()
  @IsUUID('all', { each: true })
  assignedUserIds?: string[];

  @ApiPropertyOptional({
    example: '2026-11-21',
    description: 'Defaults to today (habit timezone).',
  })
  @IsOptional()
  @IsLocalDateString()
  startDate?: string;

  @ApiPropertyOptional({ example: '2026-12-31' })
  @IsOptional()
  @IsLocalDateString()
  endDate?: string;

  @ApiPropertyOptional({
    example: '19:30',
    description: 'Local reminder time "HH:mm" (device notification)',
  })
  @IsOptional()
  @Matches(REMINDER_TIME, { message: 'reminderTime must be HH:mm' })
  reminderTime?: string;
}

export class UpdateHabitDto {
  @ApiPropertyOptional({ maxLength: 80 })
  @IsOptional()
  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  title?: string;

  @ApiPropertyOptional({ maxLength: 500, nullable: true })
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(500)
  description?: string | null;

  @ApiPropertyOptional({ enum: HABIT_ICON_KEYS })
  @IsOptional()
  @IsIn(HABIT_ICON_KEYS)
  icon?: (typeof HABIT_ICON_KEYS)[number];

  @ApiPropertyOptional({ enum: HABIT_COLORS })
  @IsOptional()
  @IsIn(HABIT_COLORS)
  color?: (typeof HABIT_COLORS)[number];

  @ApiPropertyOptional({ enum: HabitDifficulty, enumName: 'HabitDifficulty' })
  @IsOptional()
  @IsEnum(HabitDifficulty)
  difficulty?: HabitDifficulty;

  @ApiPropertyOptional({ type: [Number] })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(7)
  @ArrayUnique()
  @IsInt({ each: true })
  @Min(0, { each: true })
  @Max(6, { each: true })
  scheduleDays?: number[];

  @ApiPropertyOptional({ nullable: true, description: 'null removes the end date' })
  @IsOptional()
  @IsLocalDateString()
  endDate?: string | null;

  @ApiPropertyOptional({
    nullable: true,
    example: '19:30',
    description: 'null removes the reminder',
  })
  @IsOptional()
  @Matches(REMINDER_TIME, { message: 'reminderTime must be HH:mm' })
  reminderTime?: string | null;

  @ApiPropertyOptional({ enum: ['ACTIVE', 'ARCHIVED'] })
  @IsOptional()
  @IsIn(['ACTIVE', 'ARCHIVED'])
  status?: 'ACTIVE' | 'ARCHIVED';
}

export class SetAssignmentsDto {
  @ApiProperty({ type: [String] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(200)
  @ArrayUnique()
  @IsUUID('all', { each: true })
  userIds: string[];
}

export const HABIT_SCOPES = ['all', 'personal', 'family', 'today'] as const;
export type HabitScope = (typeof HABIT_SCOPES)[number];

export class ListHabitsQueryDto {
  @ApiPropertyOptional({
    enum: HABIT_SCOPES,
    default: 'all',
    description: '"today" = active habits you can complete that are scheduled today',
  })
  @IsOptional()
  @IsIn(HABIT_SCOPES)
  scope: HabitScope = 'all';

  @ApiPropertyOptional({ enum: ['ACTIVE', 'ARCHIVED'], default: 'ACTIVE' })
  @IsOptional()
  @IsIn(['ACTIVE', 'ARCHIVED'])
  status: 'ACTIVE' | 'ARCHIVED' = 'ACTIVE';
}

export class CalendarQueryDto {
  @ApiPropertyOptional({ example: '2026-11', description: 'Defaults to the current month' })
  @IsOptional()
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/, { message: 'month must be YYYY-MM' })
  month?: string;
}

export class CompleteHabitDto {
  @ApiProperty({ description: 'Client-generated UUID; retries with the same key are idempotent.' })
  @IsUUID()
  idempotencyKey: string;

  @ApiPropertyOptional({
    example: '2026-11-21',
    description: 'Must be today in the habit timezone.',
  })
  @IsOptional()
  @IsLocalDateString()
  localDate?: string;

  @ApiPropertyOptional({ maxLength: 280 })
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(280)
  note?: string;
}

export class ListCompletionsQueryDto {
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

// ─── Responses ───

export { PersonRefDto };

export class StreakDto {
  current: number;
  longest: number;
}

export class HabitTodayDto {
  /** Today in the habit timezone (YYYY-MM-DD) */
  date: string;
  isScheduled: boolean;
  isCompleted: boolean;
  /** Completion counting for the caller (own one, or the family one for SHARED) */
  completionId: string | null;
  @ApiPropertyOptional({ type: PersonRefDto, nullable: true })
  completedBy: PersonRefDto | null;
  /** The caller may undo today's completion */
  canUndo: boolean;
}

export class HabitDto {
  id: string;
  @ApiProperty({ enum: HabitType, enumName: 'HabitType' })
  type: HabitType;
  @ApiPropertyOptional({
    enum: HabitCompletionMode,
    enumName: 'HabitCompletionMode',
    nullable: true,
  })
  completionMode: HabitCompletionMode | null;
  title: string;
  description: string | null;
  icon: string;
  color: string;
  @ApiProperty({ enum: HabitDifficulty, enumName: 'HabitDifficulty' })
  difficulty: HabitDifficulty;
  /** Personal XP per completion (server configuration) */
  xpReward: number;
  @ApiProperty({ enum: HabitStatus, enumName: 'HabitStatus' })
  status: HabitStatus;
  startDate: string;
  endDate: string | null;
  /** Local "HH:mm" reminder time, or null */
  reminderTime: string | null;
  timezone: string;
  scheduleDays: number[];
  familyId: string | null;
  creatorId: string;
  @ApiProperty({ type: [PersonRefDto] })
  assignees: PersonRefDto[];
  canManage: boolean;
  canComplete: boolean;
  today: HabitTodayDto;
  /** Caller's streak, or the family streak for SHARED habits */
  streak: StreakDto;
}

export class MemberTodayDto extends PersonRefDto {
  completed: boolean;
}

export class HabitDetailDto extends HabitDto {
  /** PER_MEMBER only: who has completed today */
  @ApiPropertyOptional({ type: [MemberTodayDto], nullable: true })
  todayByMember: MemberTodayDto[] | null;
}

export class CalendarDayDto {
  date: string;
  isScheduled: boolean;
  isCompleted: boolean;
  isFuture: boolean;
}

export class HabitCalendarDto {
  month: string;
  today: string;
  @ApiProperty({ type: [CalendarDayDto] })
  days: CalendarDayDto[];
  scheduledCount: number;
  completedCount: number;
}

export class CompletionDto {
  id: string;
  habitId: string;
  localDate: string;
  completedBy: PersonRefDto;
  note: string | null;
  source: string;
  createdAt: string;
}

export class CompletionResultDto {
  completion: CompletionDto;
  streak: StreakDto;
  /** true when this request repeated an earlier idempotency key (nothing new was recorded) */
  replayed: boolean;
  /** XP granted by this completion (server-calculated) */
  rewards: RewardsDto;
  /** Caller's personal wallet after this completion (incl. achievement XP) */
  gamification: LevelStateDto;
  /** Family wallet after this completion (FAMILY habits only) */
  @ApiPropertyOptional({ type: LevelStateDto, nullable: true })
  family: LevelStateDto | null;
  /** Pet progress after this completion (null only for legacy replays without a pet) */
  @ApiPropertyOptional({ type: PetProgressDto, nullable: true })
  pet: PetProgressDto | null;
  @ApiProperty({ type: [AchievementUnlockDto] })
  achievementsUnlocked: AchievementUnlockDto[];
  @ApiProperty({ type: [AccessoryUnlockDto] })
  accessoriesUnlocked: AccessoryUnlockDto[];
  /** Quests that became claimable with this completion */
  @ApiProperty({ type: [QuestCompletedDto] })
  questsCompleted: QuestCompletedDto[];
}

export class UndoResultDto {
  habitId: string;
  streak: StreakDto;
  /** Negative amounts that were reversed */
  rewards: RewardsDto;
  gamification: LevelStateDto;
}
