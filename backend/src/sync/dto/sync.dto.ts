import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsISO8601,
  IsObject,
  IsOptional,
  IsUUID,
  ValidateNested,
} from 'class-validator';
import { FamilyDto, FamilyMemberDto } from '../../families/dto/family.dto';
import { MyGamificationDto } from '../../gamification/dto/gamification.dto';
import { SyncOperationStatus, SyncOperationType } from '../../generated/prisma/enums';
import { HabitDto } from '../../habits/dto/habit.dto';

export class SyncOperationInputDto {
  @ApiProperty({
    description: 'Client-generated UUID, unique per operation (replays are idempotent)',
  })
  @IsUUID()
  operationId: string;

  @ApiProperty({ enum: SyncOperationType, enumName: 'SyncOperationType' })
  @IsEnum(SyncOperationType)
  type: SyncOperationType;

  @ApiProperty({ example: '2026-11-21T08:30:00+08:00', description: 'Client clock (audit only)' })
  @IsISO8601()
  createdAt: string;

  @ApiProperty({
    type: 'object',
    additionalProperties: true,
    example: { habitId: 'uuid', localDate: '2026-11-21', idempotencyKey: 'uuid' },
    description:
      'HABIT_COMPLETION: { habitId, localDate, idempotencyKey, note? } · ' +
      'COMPLETION_UNDO: { completionId } · PET_CARE: { type, idempotencyKey }',
  })
  @IsObject()
  payload: Record<string, unknown>;
}

export class SyncPushDto {
  @ApiProperty({ type: [SyncOperationInputDto], maxItems: 100 })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => SyncOperationInputDto)
  operations: SyncOperationInputDto[];
}

export class SyncOperationResultDto {
  operationId: string;
  @ApiProperty({ enum: SyncOperationType, enumName: 'SyncOperationType' })
  type: SyncOperationType;
  /**
   * PROCESSED / REJECTED / CONFLICT are final (drop from the queue);
   * FAILED is temporary (retry with backoff).
   */
  @ApiProperty({ enum: SyncOperationStatus, enumName: 'SyncOperationStatus' })
  status: SyncOperationStatus;
  errorCode: string | null;
  /** Mongolian explanation for REJECTED / CONFLICT */
  message: string | null;
  /** true when this operation had already been processed (nothing new happened) */
  replayed: boolean;
  @ApiPropertyOptional({ type: 'object', additionalProperties: true, nullable: true })
  data: Record<string, unknown> | null;
}

export class SyncPushResultDto {
  serverTime: string;
  @ApiProperty({ type: [SyncOperationResultDto] })
  results: SyncOperationResultDto[];
}

export class SyncPullQueryDto {
  @ApiPropertyOptional({ description: 'ISO time of the previous pull (informational)' })
  @IsOptional()
  @IsISO8601()
  since?: string;
}

export class SyncPullDto {
  serverTime: string;
  /** Every active habit the user can see, with today state and streak (server truth) */
  @ApiProperty({ type: [HabitDto] })
  habits: HabitDto[];
  gamification: MyGamificationDto;
  @ApiPropertyOptional({ type: FamilyDto, nullable: true })
  family: FamilyDto | null;
  @ApiProperty({ type: [FamilyMemberDto] })
  members: FamilyMemberDto[];
  /** Operations still not final on the server (normally 0) */
  pendingOperations: number;
}

export class SyncStatusItemDto {
  operationId: string;
  @ApiProperty({ enum: SyncOperationType, enumName: 'SyncOperationType' })
  type: SyncOperationType;
  @ApiProperty({ enum: SyncOperationStatus, enumName: 'SyncOperationStatus' })
  status: SyncOperationStatus;
  errorCode: string | null;
  createdAt: string;
  processedAt: string | null;
}

export class SyncStatusDto {
  serverTime: string;
  /** Offline completions may be synced for this many past days */
  offlineWindowDays: number;
  counts: Record<string, number>;
  lastProcessedAt: string | null;
  @ApiProperty({ type: [SyncStatusItemDto] })
  recent: SyncStatusItemDto[];
}
