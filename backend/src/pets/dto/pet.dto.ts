import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { Trim } from '../../common/validation';
import { AchievementUnlockDto } from '../../gamification/dto/gamification.dto';
import { QuestCompletedDto } from '../../quests/dto/quest.dto';
import {
  AccessoryUnlockType,
  PetAccessoryRarity,
  PetAccessorySlot,
  PetCareType,
} from '../../generated/prisma/enums';
import { PET_SPECIES, PetMood, PetSpecies } from '../pet-rules';

export class UpdatePetDto {
  @ApiPropertyOptional({ maxLength: 30, example: 'Бамбаа' })
  @IsOptional()
  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  name?: string;

  @ApiPropertyOptional({ enum: PET_SPECIES })
  @IsOptional()
  @IsIn(PET_SPECIES)
  species?: PetSpecies;
}

export class CareDto {
  @ApiProperty({ enum: PetCareType, enumName: 'PetCareType' })
  @IsEnum(PetCareType)
  type: PetCareType;

  @ApiProperty({ description: 'Client-generated UUID; retries are idempotent.' })
  @IsUUID()
  idempotencyKey: string;
}

export class PetHistoryQueryDto {
  @ApiPropertyOptional({ minimum: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @ApiPropertyOptional({ minimum: 1, maximum: 100, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;
}

// ─── Responses ───

export class CareOptionDto {
  @ApiProperty({ enum: PetCareType, enumName: 'PetCareType' })
  type: PetCareType;
  xp: number;
  happiness: number;
  cooldownMinutes: number;
  /** ISO time when it can be used again; null = available now */
  availableAt: string | null;
}

export class EquippedAccessoryDto {
  id: string;
  key: string;
  name: string;
  @ApiProperty({ enum: PetAccessorySlot, enumName: 'PetAccessorySlot' })
  slot: PetAccessorySlot;
  assetKey: string;
}

export class PetDto {
  id: string;
  name: string;
  @ApiProperty({ enum: PET_SPECIES })
  species: string;
  level: number;
  lifetimeXP: number;
  xpIntoLevel: number;
  xpForNextLevel: number;
  /** 0–100, gentle read-time decay already applied */
  happiness: number;
  @ApiProperty({ enum: ['HAPPY', 'CONTENT', 'LONELY'] })
  mood: PetMood;
  lastCaredAt: string | null;
  @ApiProperty({ type: [CareOptionDto] })
  care: CareOptionDto[];
  @ApiProperty({ type: [EquippedAccessoryDto] })
  equipped: EquippedAccessoryDto[];
  accessoriesUnlocked: number;
  accessoriesTotal: number;
}

export class AccessoryDto {
  id: string;
  key: string;
  name: string;
  @ApiProperty({ enum: PetAccessorySlot, enumName: 'PetAccessorySlot' })
  slot: PetAccessorySlot;
  @ApiProperty({ enum: PetAccessoryRarity, enumName: 'PetAccessoryRarity' })
  rarity: PetAccessoryRarity;
  assetKey: string;
  @ApiProperty({ enum: AccessoryUnlockType, enumName: 'AccessoryUnlockType' })
  unlockType: AccessoryUnlockType;
  /** Mongolian description of the requirement */
  requirement: string;
  /** 0–1 progress towards unlocking */
  progress: number;
  unlocked: boolean;
  equipped: boolean;
  unlockedAt: string | null;
}

export class AccessoryUnlockDto {
  id: string;
  key: string;
  name: string;
  @ApiProperty({ enum: PetAccessorySlot, enumName: 'PetAccessorySlot' })
  slot: PetAccessorySlot;
  @ApiProperty({ enum: PetAccessoryRarity, enumName: 'PetAccessoryRarity' })
  rarity: PetAccessoryRarity;
  assetKey: string;
}

export class PetProgressDto {
  level: number;
  lifetimeXP: number;
  xpIntoLevel: number;
  xpForNextLevel: number;
  happiness: number;
  leveledUp: boolean;
}

export class CareResultDto {
  @ApiProperty({ enum: PetCareType, enumName: 'PetCareType' })
  type: PetCareType;
  petXP: number;
  happinessDelta: number;
  replayed: boolean;
  leveledUp: boolean;
  pet: PetDto;
  @ApiProperty({ type: [AccessoryUnlockDto] })
  accessoriesUnlocked: AccessoryUnlockDto[];
  @ApiProperty({ type: [QuestCompletedDto] })
  questsCompleted: QuestCompletedDto[];
  @ApiProperty({ type: [AchievementUnlockDto] })
  achievementsUnlocked: AchievementUnlockDto[];
}

export class PetHistoryItemDto {
  id: string;
  amount: number;
  /** Mongolian label */
  title: string;
  createdAt: string;
}
