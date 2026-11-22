import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID, Matches } from 'class-validator';
import { IsLocalDateString } from '../../habits/dto/habit.dto';

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

export class GeneratePlanDto {
  @ApiProperty({ description: 'Client UUID; retries return the same draft.' })
  @IsUUID()
  idempotencyKey: string;

  @ApiPropertyOptional({
    example: '08:00',
    description: 'Earliest start (defaults to now / 07:00)',
  })
  @IsOptional()
  @Matches(HHMM, { message: 'availableFrom must be HH:mm' })
  availableFrom?: string;

  @ApiPropertyOptional({ example: '22:00' })
  @IsOptional()
  @Matches(HHMM, { message: 'availableTo must be HH:mm' })
  availableTo?: string;
}

export class RegeneratePlanDto {
  @ApiProperty({ description: 'Client UUID for the new draft.' })
  @IsUUID()
  idempotencyKey: string;
}

export class PlanQueryDto {
  @ApiPropertyOptional({ example: '2026-11-22', description: "Defaults to the user's today" })
  @IsOptional()
  @IsLocalDateString()
  date?: string;
}

export class PlanItemDto {
  id: string;
  habitId: string;
  title: string;
  startTime: string;
  durationMinutes: number;
  order: number;
  note: string | null;
  /** Whether the habit is already completed for the plan's date */
  completed: boolean;
}

export class PlanWarningDto {
  @ApiProperty({ enum: ['OVERLOAD', 'CONFLICT_RESOLVED', 'NOT_PLANNED', 'OUTSIDE_WINDOW'] })
  code: string;
  message: string;
}

export class PlanDto {
  id: string;
  date: string;
  @ApiProperty({ enum: ['DRAFT', 'ACTIVE', 'COMPLETED', 'CANCELLED'] })
  status: 'DRAFT' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
  summary: string;
  @ApiProperty({ type: [PlanWarningDto] })
  warnings: PlanWarningDto[];
  @ApiProperty({ type: [PlanItemDto] })
  items: PlanItemDto[];
  totalMinutes: number;
  confirmedAt: string | null;
  createdAt: string;
}

export class DayPlansDto {
  date: string;
  @ApiPropertyOptional({ type: PlanDto, nullable: true })
  active: PlanDto | null;
  @ApiPropertyOptional({ type: PlanDto, nullable: true })
  draft: PlanDto | null;
}
