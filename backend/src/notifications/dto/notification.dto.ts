import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsString, Matches, MaxLength } from 'class-validator';
import { NotificationType, PushPlatform } from '../../generated/prisma/enums';

export class NotificationDto {
  id: string;
  @ApiProperty({ enum: NotificationType, enumName: 'NotificationType' })
  type: NotificationType;
  title: string;
  body: string;
  /** Client hints, e.g. { route: '/rewards' } */
  @ApiPropertyOptional({ type: 'object', additionalProperties: true, nullable: true })
  data: Record<string, unknown> | null;
  readAt: string | null;
  createdAt: string;
}

export class UnreadCountDto {
  unread: number;
}

/** Expo push token, e.g. "ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]". */
const EXPO_TOKEN = /^Expo(nent)?PushToken\[[A-Za-z0-9_-]{10,}\]$/;

export class PushTokenDto {
  @ApiProperty({ example: 'ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]' })
  @IsString()
  @MaxLength(255)
  @Matches(EXPO_TOKEN, { message: 'token must be an Expo push token' })
  token: string;

  @ApiProperty({ enum: PushPlatform, enumName: 'PushPlatform' })
  @IsEnum(PushPlatform)
  platform: PushPlatform;
}

export class RemovePushTokenDto {
  @ApiProperty({ example: 'ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]' })
  @IsString()
  @MaxLength(255)
  token: string;
}
