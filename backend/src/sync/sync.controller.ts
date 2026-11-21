import { Body, Controller, Get, HttpCode, HttpStatus, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  ApiEnvelopeResponse,
  ApiErrorResponses,
} from '../common/decorators/api-envelope.decorator';
import { AuthUser, CurrentUser } from '../common/decorators/auth.decorators';
import {
  SyncPullDto,
  SyncPullQueryDto,
  SyncPushDto,
  SyncPushResultDto,
  SyncStatusDto,
} from './dto/sync.dto';
import { SyncService } from './sync.service';

@ApiTags('Sync')
@ApiBearerAuth()
@Controller('sync')
export class SyncController {
  constructor(private readonly sync: SyncService) {}

  @Post('push')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Upload offline operations (max 100). Each one succeeds or fails on its own.',
    description:
      'Per-operation status: PROCESSED, REJECTED (invalid), CONFLICT (e.g. already completed) — ' +
      'all final; FAILED — temporary, retry with backoff. Replays return the stored result.',
  })
  @ApiEnvelopeResponse(SyncPushResultDto)
  @ApiErrorResponses(400, 401, 429)
  push(@CurrentUser() user: AuthUser, @Body() dto: SyncPushDto): Promise<SyncPushResultDto> {
    return this.sync.push(user.userId, dto.operations);
  }

  @Get('pull')
  @ApiOperation({ summary: 'Server-truth snapshot for the offline cache (habits, XP, family)' })
  @ApiEnvelopeResponse(SyncPullDto)
  @ApiErrorResponses(400, 401)
  pull(@CurrentUser() user: AuthUser, @Query() _query: SyncPullQueryDto): Promise<SyncPullDto> {
    return this.sync.pull(user.userId);
  }

  @Get('status')
  @ApiOperation({ summary: 'Recent sync operations and counts per status' })
  @ApiEnvelopeResponse(SyncStatusDto)
  @ApiErrorResponses(401)
  status(@CurrentUser() user: AuthUser): Promise<SyncStatusDto> {
    return this.sync.status(user.userId);
  }
}
