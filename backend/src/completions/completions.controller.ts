import { Body, Controller, Delete, Get, Param, Post, Query, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import {
  ApiEnvelopeResponse,
  ApiErrorResponses,
} from '../common/decorators/api-envelope.decorator';
import { AuthUser, CurrentUser } from '../common/decorators/auth.decorators';
import { Paginated } from '../common/dto/paginated';
import { UuidPipe } from '../common/pipes/uuid.pipe';
import {
  CompleteHabitDto,
  CompletionDto,
  CompletionResultDto,
  ListCompletionsQueryDto,
  UndoResultDto,
} from '../habits/dto/habit.dto';
import { CompletionsService } from './completions.service';

@ApiTags('Completions')
@ApiBearerAuth()
@Controller()
export class CompletionsController {
  constructor(private readonly completions: CompletionsService) {}

  @Post('habits/:id/completions')
  @ApiOperation({
    summary: 'Complete a habit for today (idempotent per idempotencyKey)',
    description:
      '201 = recorded, 200 = replay of an earlier request with the same key. ' +
      '409 ALREADY_COMPLETED when the day is already done (SHARED: by anyone in the family).',
  })
  @ApiEnvelopeResponse(CompletionResultDto, { status: 201 })
  @ApiErrorResponses(400, 401, 403, 404, 409, 422)
  async complete(
    @CurrentUser() user: AuthUser,
    @Param('id', UuidPipe) habitId: string,
    @Body() dto: CompleteHabitDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<CompletionResultDto> {
    const result = await this.completions.complete(user.userId, habitId, dto);
    res.status(result.replayed ? 200 : 201);
    return result;
  }

  @Get('habits/:id/completions')
  @ApiOperation({ summary: 'Completion history (newest first, paginated)' })
  @ApiEnvelopeResponse(CompletionDto, { isArray: true })
  @ApiErrorResponses(400, 401, 404)
  list(
    @CurrentUser() user: AuthUser,
    @Param('id', UuidPipe) habitId: string,
    @Query() query: ListCompletionsQueryDto,
  ): Promise<Paginated<CompletionDto>> {
    return this.completions.list(user.userId, habitId, query);
  }

  @Delete('completions/:id')
  @ApiOperation({ summary: "Undo today's completion (only by the member who completed it)" })
  @ApiEnvelopeResponse(UndoResultDto)
  @ApiErrorResponses(400, 401, 404, 409)
  undo(@CurrentUser() user: AuthUser, @Param('id', UuidPipe) id: string): Promise<UndoResultDto> {
    return this.completions.undo(user.userId, id);
  }
}
