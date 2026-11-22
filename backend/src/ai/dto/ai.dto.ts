import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
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
} from 'class-validator';
import { HabitDifficulty } from '../../generated/prisma/enums';
import { HabitDetailDto } from '../../habits/dto/habit.dto';

// ───────────── Status & preferences ─────────────

export class AIStatusDto {
  enabled: boolean;
  @ApiPropertyOptional({ enum: ['NOT_CONFIGURED', 'DISABLED', 'USER_DISABLED'], nullable: true })
  reason: 'NOT_CONFIGURED' | 'DISABLED' | 'USER_DISABLED' | null;
  dailyLimit: number;
  usedToday: number;
  remainingToday: number;
}

export class AIPreferencesDto {
  aiEnabled: boolean;
  goals: string | null;
  availableMinutesPerDay: number | null;
  @ApiPropertyOptional({ enum: HabitDifficulty, enumName: 'HabitDifficulty', nullable: true })
  preferredDifficulty: HabitDifficulty | null;
}

export class UpdateAIPreferencesDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  aiEnabled?: boolean;

  @ApiPropertyOptional({ maxLength: 500, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  goals?: string | null;

  @ApiPropertyOptional({ minimum: 5, maximum: 600, nullable: true })
  @IsOptional()
  @IsInt()
  @Min(5)
  @Max(600)
  availableMinutesPerDay?: number | null;

  @ApiPropertyOptional({ enum: HabitDifficulty, enumName: 'HabitDifficulty', nullable: true })
  @IsOptional()
  @IsEnum(HabitDifficulty)
  preferredDifficulty?: HabitDifficulty | null;
}

// ───────────── Coach recommendations ─────────────

export class RecommendRequestDto {
  @ApiProperty({ example: 'Илүү их ном уншдаг болмоор байна', maxLength: 500 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  goal: string;

  @ApiProperty({ description: 'Client UUID; retrying the same request returns the same set.' })
  @IsUUID()
  idempotencyKey: string;
}

export class RecommendationProposalDto {
  title: string;
  description: string;
  icon: string;
  @ApiProperty({ enum: ['EASY', 'MEDIUM', 'HARD'] })
  difficulty: 'EASY' | 'MEDIUM' | 'HARD';
  @ApiProperty({ enum: ['DAILY', 'WEEKLY', 'CUSTOM'] })
  frequency: 'DAILY' | 'WEEKLY' | 'CUSTOM';
  scheduleDays: number[];
  estimatedMinutes: number;
  reason: string;
  expectedBenefit: string;
}

export class RecommendationDto {
  id: string;
  @ApiProperty({ enum: ['PENDING', 'ACCEPTED', 'REJECTED', 'EXPIRED'] })
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'EXPIRED';
  goal: string;
  proposal: RecommendationProposalDto;
  createdHabitId: string | null;
  expiresAt: string;
  createdAt: string;
}

export class AcceptRecommendationDto {
  @ApiPropertyOptional({ maxLength: 80, description: 'Edit the title before creating the habit' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  title?: string;

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

  @ApiPropertyOptional({ example: '19:30' })
  @IsOptional()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: 'reminderTime must be HH:mm' })
  reminderTime?: string;
}

export class AcceptResultDto {
  recommendation: RecommendationDto;
  habit: HabitDetailDto;
}

export class RejectRecommendationDto {
  @ApiPropertyOptional({ maxLength: 300 })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  reason?: string;
}

export class ListRecommendationsQueryDto {
  @ApiPropertyOptional({ enum: ['PENDING', 'ACCEPTED', 'REJECTED', 'EXPIRED'], default: 'PENDING' })
  @IsOptional()
  @IsIn(['PENDING', 'ACCEPTED', 'REJECTED', 'EXPIRED'])
  status?: 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'EXPIRED';
}

// ───────────── Coach chat & conversations ─────────────

export class ChatRequestDto {
  @ApiPropertyOptional({ description: 'Continue an existing conversation' })
  @IsOptional()
  @IsUUID()
  conversationId?: string;

  @ApiProperty({ maxLength: 1000 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  message: string;

  @ApiProperty({ description: 'Client UUID for this message; retries do not duplicate turns.' })
  @IsUUID()
  clientKey: string;
}

export class AIMessageDto {
  id: string;
  @ApiProperty({ enum: ['USER', 'ASSISTANT'] })
  role: 'USER' | 'ASSISTANT';
  content: string;
  createdAt: string;
}

export class ChatResultDto {
  conversationId: string;
  userMessage: AIMessageDto;
  assistantMessage: AIMessageDto;
}

export class ConversationSummaryDto {
  id: string;
  title: string;
  lastMessageAt: string;
  createdAt: string;
}

export class ConversationDto extends ConversationSummaryDto {
  @ApiProperty({ type: [AIMessageDto] })
  messages: AIMessageDto[];
}
