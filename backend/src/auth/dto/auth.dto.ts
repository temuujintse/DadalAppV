import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { USER_AVATAR_KEYS } from '../../common/constants';
import { IsTimeZone } from '../../common/utils/timezone.util';
import { NormalizeEmail, Trim } from '../../common/validation';
import { MeDto } from '../../users/dto/me.dto';

export class RegisterDto {
  @ApiProperty({ example: 'bat@example.com' })
  @NormalizeEmail()
  @IsEmail()
  @MaxLength(254)
  email: string;

  @ApiProperty({ minLength: 8, maxLength: 128, description: 'Үсэг болон тоо агуулсан байх.' })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  @Matches(/^(?=.*\p{L})(?=.*\d).+$/u, { message: 'password must contain a letter and a digit' })
  password: string;

  @ApiProperty({ example: 'Бат', maxLength: 50 })
  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  displayName: string;

  @ApiPropertyOptional({ enum: USER_AVATAR_KEYS, default: 'fox' })
  @IsOptional()
  @IsIn(USER_AVATAR_KEYS)
  avatarKey?: (typeof USER_AVATAR_KEYS)[number];

  @ApiPropertyOptional({ example: 'Asia/Ulaanbaatar' })
  @IsOptional()
  @IsTimeZone()
  timezone?: string;
}

export class LoginDto {
  @ApiProperty({ example: 'bat@example.com' })
  @NormalizeEmail()
  @IsEmail()
  @MaxLength(254)
  email: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  password: string;
}

export class RefreshDto {
  @ApiProperty({ description: 'Opaque refresh token returned by login/register/refresh.' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  refreshToken: string;
}

export class TokenPairDto {
  accessToken: string;
  /** ISO timestamp */
  accessTokenExpiresAt: string;
  refreshToken: string;
  /** ISO timestamp */
  refreshTokenExpiresAt: string;
}

export class AuthResultDto {
  user: MeDto;
  tokens: TokenPairDto;
}
