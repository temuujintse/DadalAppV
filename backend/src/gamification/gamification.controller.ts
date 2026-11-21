import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  ApiEnvelopeResponse,
  ApiErrorResponses,
} from '../common/decorators/api-envelope.decorator';
import { AuthUser, CurrentUser } from '../common/decorators/auth.decorators';
import { Paginated } from '../common/dto/paginated';
import {
  AchievementDto,
  FamilyGamificationDto,
  LeaderboardDto,
  LeaderboardQueryDto,
  MyGamificationDto,
  TransactionsQueryDto,
  XpTransactionDto,
} from './dto/gamification.dto';
import { GamificationService } from './gamification.service';

@ApiTags('Gamification')
@ApiBearerAuth()
@Controller('gamification')
export class GamificationController {
  constructor(private readonly gamification: GamificationService) {}

  @Get('me')
  @ApiOperation({ summary: 'Personal level, XP, activity statistics' })
  @ApiEnvelopeResponse(MyGamificationDto)
  @ApiErrorResponses(401)
  me(@CurrentUser() user: AuthUser): Promise<MyGamificationDto> {
    return this.gamification.getMe(user.userId);
  }

  @Get('family')
  @ApiOperation({ summary: 'Family level and XP (family wallet)' })
  @ApiEnvelopeResponse(FamilyGamificationDto)
  @ApiErrorResponses(401, 404)
  family(@CurrentUser() user: AuthUser): Promise<FamilyGamificationDto> {
    return this.gamification.getFamily(user.userId);
  }

  @Get('me/transactions')
  @ApiOperation({ summary: 'Personal XP ledger, newest first' })
  @ApiEnvelopeResponse(XpTransactionDto, { isArray: true })
  @ApiErrorResponses(400, 401)
  transactions(
    @CurrentUser() user: AuthUser,
    @Query() query: TransactionsQueryDto,
  ): Promise<Paginated<XpTransactionDto>> {
    return this.gamification.transactions(user.userId, query);
  }

  @Get('leaderboard')
  @ApiOperation({ summary: 'In-family leaderboard (week / month / all time)' })
  @ApiEnvelopeResponse(LeaderboardDto)
  @ApiErrorResponses(400, 401, 404)
  leaderboard(
    @CurrentUser() user: AuthUser,
    @Query() query: LeaderboardQueryDto,
  ): Promise<LeaderboardDto> {
    return this.gamification.leaderboard(user.userId, query.period);
  }

  @Get('achievements')
  @ApiOperation({ summary: 'All achievements with progress and unlock time' })
  @ApiEnvelopeResponse(AchievementDto, { isArray: true })
  @ApiErrorResponses(401)
  achievements(@CurrentUser() user: AuthUser): Promise<AchievementDto[]> {
    return this.gamification.listAchievements(user.userId);
  }
}
