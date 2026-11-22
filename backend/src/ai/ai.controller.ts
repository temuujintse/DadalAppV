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
import { SensitiveRateLimit } from '../common/guards/rate-limit';
import { UuidPipe } from '../common/pipes/uuid.pipe';
import { AIOrchestrator } from './ai-orchestrator.service';
import { AnalyticsService } from './analytics/analytics.service';
import { AnalyticsDto } from './dto/analytics.dto';
import { PetInteractDto, PetInteractionDto } from './dto/pet-ai.dto';
import {
  DayPlansDto,
  GeneratePlanDto,
  PlanDto,
  PlanQueryDto,
  RegeneratePlanDto,
} from './dto/planner.dto';
import { PetCompanionService } from './pet/pet-companion.service';
import { PlannerService } from './planner/planner.service';
import { CoachService } from './coach/coach.service';
import {
  AcceptRecommendationDto,
  AcceptResultDto,
  AIPreferencesDto,
  AIStatusDto,
  ChatRequestDto,
  ChatResultDto,
  ConversationDto,
  ConversationSummaryDto,
  ListRecommendationsQueryDto,
  RecommendationDto,
  RecommendRequestDto,
  RejectRecommendationDto,
  UpdateAIPreferencesDto,
} from './dto/ai.dto';
import { AIPreferencesService } from './preferences.service';

/**
 * AI endpoints. Every route is per-user (JWT); records of other users answer 404.
 * Generating routes are rate limited per IP and counted against the daily AI quota.
 */
@ApiTags('AI')
@ApiBearerAuth()
@Controller('ai')
export class AIController {
  constructor(
    private readonly orchestrator: AIOrchestrator,
    private readonly coach: CoachService,
    private readonly preferences: AIPreferencesService,
    private readonly planner: PlannerService,
    private readonly pet: PetCompanionService,
    private readonly analytics: AnalyticsService,
  ) {}

  // ───────────── Smart Planner ─────────────

  @SensitiveRateLimit()
  @Post('planner/generate')
  @ApiOperation({ summary: "Propose a DRAFT plan for today's open habits" })
  @ApiEnvelopeResponse(PlanDto, { status: 201 })
  @ApiErrorResponses(400, 401, 409, 429, 502, 503)
  generatePlan(@CurrentUser() user: AuthUser, @Body() dto: GeneratePlanDto): Promise<PlanDto> {
    return this.planner.generate(user.userId, dto);
  }

  @Get('planner')
  @ApiOperation({ summary: 'Active and draft plan for a day (default today)' })
  @ApiEnvelopeResponse(DayPlansDto)
  @ApiErrorResponses(400, 401)
  dayPlans(@CurrentUser() user: AuthUser, @Query() query: PlanQueryDto): Promise<DayPlansDto> {
    return this.planner.forDay(user.userId, query.date);
  }

  @Post('planner/:id/confirm')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Confirm a draft: it becomes the ACTIVE plan of the day' })
  @ApiEnvelopeResponse(PlanDto)
  @ApiErrorResponses(401, 404, 409, 410)
  confirmPlan(@CurrentUser() user: AuthUser, @Param('id', UuidPipe) id: string): Promise<PlanDto> {
    return this.planner.confirm(user.userId, id);
  }

  @SensitiveRateLimit()
  @Post('planner/:id/regenerate')
  @ApiOperation({ summary: 'Replace a plan with a new draft' })
  @ApiEnvelopeResponse(PlanDto, { status: 201 })
  @ApiErrorResponses(400, 401, 404, 409, 429, 502, 503)
  regeneratePlan(
    @CurrentUser() user: AuthUser,
    @Param('id', UuidPipe) id: string,
    @Body() dto: RegeneratePlanDto,
  ): Promise<PlanDto> {
    return this.planner.regenerate(user.userId, id, dto.idempotencyKey);
  }

  // ───────────── Pet companion ─────────────

  @Post('pet/interact')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'A short pet message for this moment (templates; AI only for special events)',
  })
  @ApiEnvelopeResponse(PetInteractionDto)
  @ApiErrorResponses(400, 401)
  petInteract(
    @CurrentUser() user: AuthUser,
    @Body() dto: PetInteractDto,
  ): Promise<PetInteractionDto> {
    return this.pet.interact(user.userId, dto.event);
  }

  // ───────────── Analytics ─────────────

  @Get('analytics/weekly')
  @ApiOperation({ summary: 'Last complete week: backend metrics + AI explanation (cached)' })
  @ApiEnvelopeResponse(AnalyticsDto)
  @ApiErrorResponses(401)
  weekly(@CurrentUser() user: AuthUser): Promise<AnalyticsDto> {
    return this.analytics.get(user.userId, 'WEEKLY');
  }

  @Get('analytics/monthly')
  @ApiOperation({ summary: 'Last complete month: backend metrics + AI explanation (cached)' })
  @ApiEnvelopeResponse(AnalyticsDto)
  @ApiErrorResponses(401)
  monthly(@CurrentUser() user: AuthUser): Promise<AnalyticsDto> {
    return this.analytics.get(user.userId, 'MONTHLY');
  }

  @Get('status')
  @ApiOperation({ summary: 'Whether AI is available for this user and the remaining daily quota' })
  @ApiEnvelopeResponse(AIStatusDto)
  @ApiErrorResponses(401)
  status(@CurrentUser() user: AuthUser): Promise<AIStatusDto> {
    return this.orchestrator.status(user.userId);
  }

  @Get('preferences')
  @ApiOperation({ summary: 'AI preferences' })
  @ApiEnvelopeResponse(AIPreferencesDto)
  @ApiErrorResponses(401)
  getPreferences(@CurrentUser() user: AuthUser): Promise<AIPreferencesDto> {
    return this.preferences.get(user.userId);
  }

  @Patch('preferences')
  @ApiOperation({ summary: 'Update AI preferences (including opting out)' })
  @ApiEnvelopeResponse(AIPreferencesDto)
  @ApiErrorResponses(400, 401)
  updatePreferences(
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateAIPreferencesDto,
  ): Promise<AIPreferencesDto> {
    return this.preferences.update(user.userId, dto);
  }

  @SensitiveRateLimit()
  @Post('coach/recommendations')
  @ApiOperation({ summary: 'Ask the coach for up to 3 habit proposals (stored as PENDING)' })
  @ApiEnvelopeResponse(RecommendationDto, { isArray: true, status: 201 })
  @ApiErrorResponses(400, 401, 422, 429, 502, 503)
  recommend(
    @CurrentUser() user: AuthUser,
    @Body() dto: RecommendRequestDto,
  ): Promise<RecommendationDto[]> {
    return this.coach.recommend(user.userId, dto);
  }

  @Get('coach/recommendations')
  @ApiOperation({ summary: 'My proposals by status (default PENDING)' })
  @ApiEnvelopeResponse(RecommendationDto, { isArray: true })
  @ApiErrorResponses(400, 401)
  listRecommendations(
    @CurrentUser() user: AuthUser,
    @Query() query: ListRecommendationsQueryDto,
  ): Promise<RecommendationDto[]> {
    return this.coach.list(user.userId, query.status);
  }

  @Post('coach/recommendations/:id/accept')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Accept a proposal: creates a real habit through the habit rules' })
  @ApiEnvelopeResponse(AcceptResultDto)
  @ApiErrorResponses(400, 401, 404, 409, 410)
  accept(
    @CurrentUser() user: AuthUser,
    @Param('id', UuidPipe) id: string,
    @Body() dto: AcceptRecommendationDto,
  ): Promise<AcceptResultDto> {
    return this.coach.accept(user.userId, id, dto);
  }

  @Post('coach/recommendations/:id/reject')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reject a proposal (the coach avoids it next time)' })
  @ApiEnvelopeResponse(RecommendationDto)
  @ApiErrorResponses(400, 401, 404, 409, 410)
  reject(
    @CurrentUser() user: AuthUser,
    @Param('id', UuidPipe) id: string,
    @Body() dto: RejectRecommendationDto,
  ): Promise<RecommendationDto> {
    return this.coach.reject(user.userId, id, dto.reason);
  }

  @SensitiveRateLimit()
  @Post('coach/chat')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Chat with the habit coach' })
  @ApiEnvelopeResponse(ChatResultDto)
  @ApiErrorResponses(400, 401, 404, 422, 429, 502, 503)
  chat(@CurrentUser() user: AuthUser, @Body() dto: ChatRequestDto): Promise<ChatResultDto> {
    return this.coach.chat(user.userId, dto);
  }

  @Get('conversations')
  @ApiOperation({ summary: 'My coach conversations' })
  @ApiEnvelopeResponse(ConversationSummaryDto, { isArray: true })
  @ApiErrorResponses(401)
  conversations(@CurrentUser() user: AuthUser): Promise<ConversationSummaryDto[]> {
    return this.coach.conversations(user.userId);
  }

  @Get('conversations/:id')
  @ApiOperation({ summary: 'One conversation with its messages' })
  @ApiEnvelopeResponse(ConversationDto)
  @ApiErrorResponses(401, 404)
  conversation(
    @CurrentUser() user: AuthUser,
    @Param('id', UuidPipe) id: string,
  ): Promise<ConversationDto> {
    return this.coach.conversation(user.userId, id);
  }

  @Delete('conversations/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete a conversation' })
  @ApiEnvelopeResponse(null)
  @ApiErrorResponses(401, 404)
  async deleteConversation(
    @CurrentUser() user: AuthUser,
    @Param('id', UuidPipe) id: string,
  ): Promise<null> {
    await this.coach.deleteConversation(user.userId, id);
    return null;
  }
}
