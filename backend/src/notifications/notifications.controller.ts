import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Paginated, PaginationQueryDto } from '../common/dto/paginated';
import {
  ApiEnvelopeResponse,
  ApiErrorResponses,
} from '../common/decorators/api-envelope.decorator';
import { AuthUser, CurrentUser } from '../common/decorators/auth.decorators';
import { UuidPipe } from '../common/pipes/uuid.pipe';
import {
  NotificationDto,
  PushTokenDto,
  RemovePushTokenDto,
  UnreadCountDto,
} from './dto/notification.dto';
import { NotificationsService } from './notifications.service';

@ApiTags('Notifications')
@ApiBearerAuth()
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  @ApiOperation({ summary: 'Inbox, newest first' })
  @ApiEnvelopeResponse(NotificationDto, { isArray: true })
  @ApiErrorResponses(400, 401)
  list(
    @CurrentUser() user: AuthUser,
    @Query() query: PaginationQueryDto,
  ): Promise<Paginated<NotificationDto>> {
    return this.notifications.list(user.userId, query);
  }

  @Get('unread-count')
  @ApiOperation({ summary: 'Number of unread notifications (badge)' })
  @ApiEnvelopeResponse(UnreadCountDto)
  @ApiErrorResponses(401)
  async unread(@CurrentUser() user: AuthUser): Promise<UnreadCountDto> {
    return { unread: await this.notifications.unreadCount(user.userId) };
  }

  @Post('read-all')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark every notification as read' })
  @ApiEnvelopeResponse(UnreadCountDto)
  @ApiErrorResponses(401)
  async readAll(@CurrentUser() user: AuthUser): Promise<UnreadCountDto> {
    await this.notifications.markAllRead(user.userId);
    return { unread: 0 };
  }

  @Post(':id/read')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark one notification as read' })
  @ApiEnvelopeResponse(NotificationDto)
  @ApiErrorResponses(401, 404)
  read(@CurrentUser() user: AuthUser, @Param('id', UuidPipe) id: string): Promise<NotificationDto> {
    return this.notifications.markRead(user.userId, id);
  }

  @Put('push-token')
  @ApiOperation({ summary: 'Register this device for push notifications' })
  @ApiEnvelopeResponse(null)
  @ApiErrorResponses(400, 401)
  async registerToken(@CurrentUser() user: AuthUser, @Body() dto: PushTokenDto): Promise<null> {
    await this.notifications.registerToken(user.userId, dto.token, dto.platform);
    return null;
  }

  @Delete('push-token')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Stop push notifications on this device (sign-out / opt-out)' })
  @ApiEnvelopeResponse(null)
  @ApiErrorResponses(400, 401)
  async removeToken(@CurrentUser() user: AuthUser, @Body() dto: RemovePushTokenDto): Promise<null> {
    await this.notifications.removeToken(user.userId, dto.token);
    return null;
  }
}
