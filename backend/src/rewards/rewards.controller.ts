import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  ApiEnvelopeResponse,
  ApiErrorResponses,
} from '../common/decorators/api-envelope.decorator';
import { AuthUser, CurrentUser } from '../common/decorators/auth.decorators';
import { UuidPipe } from '../common/pipes/uuid.pipe';
import {
  CreateRewardDto,
  DecisionDto,
  ListRedemptionsQueryDto,
  RedeemDto,
  RedemptionDecisionResultDto,
  RedemptionDto,
  RewardDto,
  UpdateRewardDto,
} from './dto/reward.dto';
import { RewardsService } from './rewards.service';

@ApiTags('Rewards')
@ApiBearerAuth()
@Controller()
export class RewardsController {
  constructor(private readonly rewards: RewardsService) {}

  @Get('rewards')
  @ApiOperation({ summary: 'Family reward catalog (managers also see inactive rewards)' })
  @ApiEnvelopeResponse(RewardDto, { isArray: true })
  @ApiErrorResponses(401, 404)
  list(@CurrentUser() user: AuthUser): Promise<RewardDto[]> {
    return this.rewards.list(user.userId);
  }

  @Post('rewards')
  @ApiOperation({ summary: 'Create a reward (OWNER/PARENT)' })
  @ApiEnvelopeResponse(RewardDto, { status: 201, isArray: true })
  @ApiErrorResponses(400, 401, 403, 404)
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateRewardDto): Promise<RewardDto[]> {
    return this.rewards.create(user.userId, dto);
  }

  @Patch('rewards/:id')
  @ApiOperation({ summary: 'Edit a reward (OWNER/PARENT); pending requests keep their price' })
  @ApiEnvelopeResponse(RewardDto, { isArray: true })
  @ApiErrorResponses(400, 401, 403, 404)
  update(
    @CurrentUser() user: AuthUser,
    @Param('id', UuidPipe) id: string,
    @Body() dto: UpdateRewardDto,
  ): Promise<RewardDto[]> {
    return this.rewards.update(user.userId, id, dto);
  }

  @Delete('rewards/:id')
  @ApiOperation({ summary: 'Delete a reward (soft); pending requests are cancelled' })
  @ApiEnvelopeResponse(null)
  @ApiErrorResponses(400, 401, 403, 404)
  remove(@CurrentUser() user: AuthUser, @Param('id', UuidPipe) id: string): Promise<null> {
    return this.rewards.remove(user.userId, id);
  }

  @Post('rewards/:id/redeem')
  @ApiOperation({ summary: 'Request a reward. XP is only spent when a parent approves.' })
  @ApiEnvelopeResponse(RedemptionDto, { status: 201 })
  @ApiErrorResponses(400, 401, 404, 409)
  redeem(
    @CurrentUser() user: AuthUser,
    @Param('id', UuidPipe) id: string,
    @Body() dto: RedeemDto,
  ): Promise<RedemptionDto> {
    return this.rewards.redeem(user.userId, id, dto.idempotencyKey, dto.note);
  }

  @Get('redemptions')
  @ApiOperation({ summary: 'Reward requests: mine, or the whole family (OWNER/PARENT)' })
  @ApiEnvelopeResponse(RedemptionDto, { isArray: true })
  @ApiErrorResponses(400, 401, 403, 404)
  redemptions(
    @CurrentUser() user: AuthUser,
    @Query() query: ListRedemptionsQueryDto,
  ): Promise<RedemptionDto[]> {
    return this.rewards.listRedemptions(user.userId, query);
  }

  @Post('redemptions/:id/approve')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Approve and spend the XP (once)' })
  @ApiEnvelopeResponse(RedemptionDecisionResultDto)
  @ApiErrorResponses(400, 401, 403, 404, 409)
  approve(
    @CurrentUser() user: AuthUser,
    @Param('id', UuidPipe) id: string,
    @Body() dto: DecisionDto,
  ): Promise<RedemptionDecisionResultDto> {
    return this.rewards.approve(user.userId, id, dto.note);
  }

  @Post('redemptions/:id/reject')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reject (no XP is spent)' })
  @ApiEnvelopeResponse(RedemptionDecisionResultDto)
  @ApiErrorResponses(400, 401, 403, 404, 409)
  reject(
    @CurrentUser() user: AuthUser,
    @Param('id', UuidPipe) id: string,
    @Body() dto: DecisionDto,
  ): Promise<RedemptionDecisionResultDto> {
    return this.rewards.reject(user.userId, id, dto.note);
  }

  @Post('redemptions/:id/complete')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark an approved reward as handed over' })
  @ApiEnvelopeResponse(RedemptionDecisionResultDto)
  @ApiErrorResponses(400, 401, 403, 404, 409)
  complete(
    @CurrentUser() user: AuthUser,
    @Param('id', UuidPipe) id: string,
  ): Promise<RedemptionDecisionResultDto> {
    return this.rewards.complete(user.userId, id);
  }

  @Post('redemptions/:id/cancel')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Withdraw my own pending request' })
  @ApiEnvelopeResponse(RedemptionDecisionResultDto)
  @ApiErrorResponses(400, 401, 404, 409)
  cancel(
    @CurrentUser() user: AuthUser,
    @Param('id', UuidPipe) id: string,
  ): Promise<RedemptionDecisionResultDto> {
    return this.rewards.cancel(user.userId, id);
  }
}
