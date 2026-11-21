import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
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
import { LevelStateDto } from '../../gamification/dto/gamification.dto';
import { RedemptionStatus } from '../../generated/prisma/enums';
import { PersonRefDto } from '../../common/dto/person-ref.dto';

export const REWARD_ICON_KEYS = [
  'gift',
  'film',
  'pizza',
  'gamepad-2',
  'ice-cream',
  'trees',
  'book',
  'music',
  'bike',
  'star',
] as const;

export class CreateRewardDto {
  @ApiProperty({ example: 'Кино сонгох эрх', maxLength: 80 })
  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  title: string;

  @ApiPropertyOptional({ maxLength: 280 })
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(280)
  description?: string;

  @ApiPropertyOptional({ enum: REWARD_ICON_KEYS, default: 'gift' })
  @IsOptional()
  @IsIn(REWARD_ICON_KEYS)
  icon?: (typeof REWARD_ICON_KEYS)[number];

  @ApiProperty({ minimum: 10, maximum: 100000, example: 150 })
  @IsInt()
  @Min(10)
  @Max(100_000)
  xpCost: number;
}

export class UpdateRewardDto {
  @ApiPropertyOptional({ maxLength: 80 })
  @IsOptional()
  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  title?: string;

  @ApiPropertyOptional({ maxLength: 280, nullable: true })
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(280)
  description?: string | null;

  @ApiPropertyOptional({ enum: REWARD_ICON_KEYS })
  @IsOptional()
  @IsIn(REWARD_ICON_KEYS)
  icon?: (typeof REWARD_ICON_KEYS)[number];

  @ApiPropertyOptional({ minimum: 10, maximum: 100000 })
  @IsOptional()
  @IsInt()
  @Min(10)
  @Max(100_000)
  xpCost?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class RedeemDto {
  @ApiProperty({ description: 'Client-generated UUID; retries are idempotent.' })
  @IsUUID()
  idempotencyKey: string;

  @ApiPropertyOptional({ maxLength: 280 })
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(280)
  note?: string;
}

export class DecisionDto {
  @ApiPropertyOptional({ maxLength: 280, description: 'Shown to the requester' })
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(280)
  note?: string;
}

export const REDEMPTION_SCOPES = ['mine', 'family'] as const;

export class ListRedemptionsQueryDto {
  @ApiPropertyOptional({
    enum: REDEMPTION_SCOPES,
    default: 'mine',
    description: '"family" requires OWNER/PARENT',
  })
  @IsOptional()
  @IsIn(REDEMPTION_SCOPES)
  scope: (typeof REDEMPTION_SCOPES)[number] = 'mine';

  @ApiPropertyOptional({ enum: RedemptionStatus, enumName: 'RedemptionStatus' })
  @IsOptional()
  @IsIn(Object.values(RedemptionStatus))
  status?: RedemptionStatus;
}

// ─── Responses ───

export class RewardDto {
  id: string;
  title: string;
  description: string | null;
  icon: string;
  xpCost: number;
  isActive: boolean;
  createdBy: PersonRefDto;
  createdAt: string;
  /** XP the caller can still commit (balance minus own pending requests) */
  availableXP: number;
  canRedeem: boolean;
}

export class RedemptionRewardRefDto {
  id: string;
  title: string;
  icon: string;
}

export class RedemptionDto {
  id: string;
  reward: RedemptionRewardRefDto;
  xpCost: number;
  @ApiProperty({ enum: RedemptionStatus, enumName: 'RedemptionStatus' })
  status: RedemptionStatus;
  note: string | null;
  decisionNote: string | null;
  requester: PersonRefDto;
  @ApiPropertyOptional({ type: PersonRefDto, nullable: true })
  decidedBy: PersonRefDto | null;
  createdAt: string;
  decidedAt: string | null;
  redeemedAt: string | null;
  /** Caller may approve / reject */
  canDecide: boolean;
  /** Caller may cancel (own pending request) */
  canCancel: boolean;
  /** Caller may mark an approved reward as handed over */
  canComplete: boolean;
}

export class RedemptionDecisionResultDto {
  redemption: RedemptionDto;
  /** Requester wallet after an approval (XP spent); null otherwise */
  @ApiPropertyOptional({ type: LevelStateDto, nullable: true })
  requesterWallet: LevelStateDto | null;
}
