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
  CalendarQueryDto,
  CreateHabitDto,
  HabitCalendarDto,
  HabitDetailDto,
  HabitDto,
  ListHabitsQueryDto,
  SetAssignmentsDto,
  UpdateHabitDto,
} from './dto/habit.dto';
import { HabitsService } from './habits.service';

@ApiTags('Habits')
@ApiBearerAuth()
@Controller('habits')
export class HabitsController {
  constructor(private readonly habits: HabitsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a PERSONAL habit, or a FAMILY habit (OWNER/PARENT)' })
  @ApiEnvelopeResponse(HabitDetailDto, { status: 201 })
  @ApiErrorResponses(400, 401, 403, 404, 422)
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateHabitDto): Promise<HabitDetailDto> {
    return this.habits.create(user.userId, dto);
  }

  @Get()
  @ApiOperation({
    summary: 'Personal habits + family habits, with today state and streak',
  })
  @ApiEnvelopeResponse(HabitDto, { isArray: true })
  @ApiErrorResponses(400, 401)
  list(@CurrentUser() user: AuthUser, @Query() query: ListHabitsQueryDto): Promise<HabitDto[]> {
    return this.habits.list(user.userId, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Habit detail (PER_MEMBER habits include who finished today)' })
  @ApiEnvelopeResponse(HabitDetailDto)
  @ApiErrorResponses(400, 401, 404)
  detail(
    @CurrentUser() user: AuthUser,
    @Param('id', UuidPipe) id: string,
  ): Promise<HabitDetailDto> {
    return this.habits.getDetail(user.userId, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Edit a habit (type and completion mode are fixed after creation)' })
  @ApiEnvelopeResponse(HabitDetailDto)
  @ApiErrorResponses(400, 401, 403, 404, 422)
  update(
    @CurrentUser() user: AuthUser,
    @Param('id', UuidPipe) id: string,
    @Body() dto: UpdateHabitDto,
  ): Promise<HabitDetailDto> {
    return this.habits.update(user.userId, id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete (soft) — history is kept' })
  @ApiEnvelopeResponse(null)
  @ApiErrorResponses(400, 401, 403, 404)
  remove(@CurrentUser() user: AuthUser, @Param('id', UuidPipe) id: string): Promise<null> {
    return this.habits.remove(user.userId, id);
  }

  @Post(':id/assignments')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Replace the assigned members of a FAMILY habit' })
  @ApiEnvelopeResponse(HabitDetailDto)
  @ApiErrorResponses(400, 401, 403, 404)
  assign(
    @CurrentUser() user: AuthUser,
    @Param('id', UuidPipe) id: string,
    @Body() dto: SetAssignmentsDto,
  ): Promise<HabitDetailDto> {
    return this.habits.setAssignments(user.userId, id, dto);
  }

  @Get(':id/calendar')
  @ApiOperation({
    summary: 'Month view: scheduled and completed days (caller or family for SHARED)',
  })
  @ApiEnvelopeResponse(HabitCalendarDto)
  @ApiErrorResponses(400, 401, 404)
  calendar(
    @CurrentUser() user: AuthUser,
    @Param('id', UuidPipe) id: string,
    @Query() query: CalendarQueryDto,
  ): Promise<HabitCalendarDto> {
    return this.habits.calendar(user.userId, id, query);
  }
}
