import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { FAMILY_AVATAR_KEYS } from '../../common/constants';
import { IsTimeZone } from '../../common/utils/timezone.util';
import { Trim } from '../../common/validation';
import { FamilyPlan, FamilyRole } from '../../generated/prisma/enums';

export class CreateFamilyDto {
  @ApiProperty({ example: 'Батын гэр бүл', maxLength: 60 })
  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  name: string;

  @ApiPropertyOptional({ enum: FAMILY_AVATAR_KEYS, default: 'home' })
  @IsOptional()
  @IsIn(FAMILY_AVATAR_KEYS)
  avatarKey?: (typeof FAMILY_AVATAR_KEYS)[number];

  @ApiPropertyOptional({
    example: 'Asia/Ulaanbaatar',
    description: "Defaults to the creator's timezone.",
  })
  @IsOptional()
  @IsTimeZone()
  timezone?: string;
}

export class UpdateFamilyDto {
  @ApiPropertyOptional({ maxLength: 60 })
  @IsOptional()
  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  name?: string;

  @ApiPropertyOptional({ enum: FAMILY_AVATAR_KEYS })
  @IsOptional()
  @IsIn(FAMILY_AVATAR_KEYS)
  avatarKey?: (typeof FAMILY_AVATAR_KEYS)[number];

  @ApiPropertyOptional({ example: 'Asia/Ulaanbaatar' })
  @IsOptional()
  @IsTimeZone()
  timezone?: string;

  @ApiPropertyOptional({ description: 'Show the in-family XP leaderboard' })
  @IsOptional()
  @IsBoolean()
  leaderboardEnabled?: boolean;
}

export class ChangeRoleDto {
  @ApiProperty({ enum: ['PARENT', 'MEMBER', 'CHILD'] })
  @IsIn(['PARENT', 'MEMBER', 'CHILD'])
  role: Exclude<FamilyRole, 'OWNER'>;
}

export class TransferOwnershipDto {
  @ApiProperty({ description: 'FamilyMember id of the new owner' })
  @IsUUID()
  memberId: string;
}

export class FamilyGamificationSummaryDto {
  lifetimeXP: number;
  level: number;
}

export class FamilyDto {
  id: string;
  name: string;
  avatarKey: string;
  timezone: string;
  @ApiProperty({ enum: FamilyPlan, enumName: 'FamilyPlan' })
  plan: FamilyPlan;
  createdAt: string;
  memberCount: number;
  myMemberId: string;
  @ApiProperty({ enum: FamilyRole, enumName: 'FamilyRole' })
  myRole: FamilyRole;
  leaderboardEnabled: boolean;
  gamification: FamilyGamificationSummaryDto;
}

export class FamilyMemberDto {
  /** FamilyMember id (use this for member endpoints) */
  id: string;
  userId: string;
  displayName: string;
  avatarKey: string;
  /** API path of the uploaded photo (authenticated), or null */
  photoUrl: string | null;
  @ApiProperty({ enum: FamilyRole, enumName: 'FamilyRole' })
  role: FamilyRole;
  joinedAt: string;
  isMe: boolean;
}

export class LeaveResultDto {
  /** true when the last member (the owner) left and the family was closed */
  familyDissolved: boolean;
}
