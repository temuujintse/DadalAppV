import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsIn, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { USER_AVATAR_KEYS } from '../../common/constants';
import { IsTimeZone } from '../../common/utils/timezone.util';
import { Trim } from '../../common/validation';
import { FamilyRole } from '../../generated/prisma/enums';

export class ProfileDto {
  displayName: string;
  avatarKey: string;
  /** API path of the uploaded photo (authenticated), or null */
  photoUrl: string | null;
  timezone: string;
  locale: string;
  /** ISO timestamp or null while onboarding is unfinished */
  onboardingCompletedAt: string | null;
}

export class MyFamilyDto {
  id: string;
  name: string;
  avatarKey: string;
  memberId: string;
  @ApiProperty({ enum: FamilyRole, enumName: 'FamilyRole' })
  role: FamilyRole;
}

export class MyGamificationDto {
  level: number;
  lifetimeXP: number;
  balanceXP: number;
}

export class MeDto {
  id: string;
  email: string;
  createdAt: string;
  profile: ProfileDto;
  @ApiPropertyOptional({ type: MyFamilyDto, nullable: true })
  family: MyFamilyDto | null;
  gamification: MyGamificationDto;
}

export class UpdateMeDto {
  @ApiPropertyOptional({ maxLength: 50 })
  @IsOptional()
  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  displayName?: string;

  @ApiPropertyOptional({ enum: USER_AVATAR_KEYS })
  @IsOptional()
  @IsIn(USER_AVATAR_KEYS)
  avatarKey?: (typeof USER_AVATAR_KEYS)[number];

  @ApiPropertyOptional({ example: 'Asia/Ulaanbaatar' })
  @IsOptional()
  @IsTimeZone()
  timezone?: string;

  @ApiPropertyOptional({ description: 'Set true once onboarding is finished.' })
  @IsOptional()
  @IsBoolean()
  onboardingCompleted?: boolean;
}

export class UploadPhotoDto {
  @ApiProperty({
    description: 'Base64 image (JPEG/PNG/WebP), resized on the device; ≤ 64 KB decoded',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(90_000)
  image: string;
}
