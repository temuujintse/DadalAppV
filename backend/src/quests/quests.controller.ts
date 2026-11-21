import { Controller, Get, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  ApiEnvelopeResponse,
  ApiErrorResponses,
} from '../common/decorators/api-envelope.decorator';
import { AuthUser, CurrentUser } from '../common/decorators/auth.decorators';
import { UuidPipe } from '../common/pipes/uuid.pipe';
import { ClaimResultDto, QuestDto } from './dto/quest.dto';
import { QuestsService } from './quests.service';

@ApiTags('Quests')
@ApiBearerAuth()
@Controller('quests')
export class QuestsController {
  constructor(private readonly quests: QuestsService) {}

  @Get()
  @ApiOperation({ summary: 'Active daily/weekly quests with progress for the current period' })
  @ApiEnvelopeResponse(QuestDto, { isArray: true })
  @ApiErrorResponses(401)
  list(@CurrentUser() user: AuthUser): Promise<QuestDto[]> {
    return this.quests.list(user.userId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'One quest with progress' })
  @ApiEnvelopeResponse(QuestDto)
  @ApiErrorResponses(400, 401, 404)
  get(@CurrentUser() user: AuthUser, @Param('id', UuidPipe) id: string): Promise<QuestDto> {
    return this.quests.get(user.userId, id);
  }

  @Post(':id/claim')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Claim the reward of a completed quest (once per period)' })
  @ApiEnvelopeResponse(ClaimResultDto)
  @ApiErrorResponses(400, 401, 404, 409)
  claim(@CurrentUser() user: AuthUser, @Param('id', UuidPipe) id: string): Promise<ClaimResultDto> {
    return this.quests.claim(user.userId, id);
  }
}
