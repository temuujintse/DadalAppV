import { Body, Controller, Get, Patch } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  ApiEnvelopeResponse,
  ApiErrorResponses,
} from '../common/decorators/api-envelope.decorator';
import { AuthUser, CurrentUser } from '../common/decorators/auth.decorators';
import { MeDto, UpdateMeDto } from './dto/me.dto';
import { UsersService } from './users.service';

@ApiTags('Users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get('me')
  @ApiOperation({ summary: 'Current user with profile, family membership and XP summary' })
  @ApiEnvelopeResponse(MeDto)
  @ApiErrorResponses(401)
  me(@CurrentUser() user: AuthUser): Promise<MeDto> {
    return this.users.getMe(user.userId);
  }

  @Patch('me')
  @ApiOperation({ summary: 'Update display name, avatar, timezone or finish onboarding' })
  @ApiEnvelopeResponse(MeDto)
  @ApiErrorResponses(400, 401)
  update(@CurrentUser() user: AuthUser, @Body() dto: UpdateMeDto): Promise<MeDto> {
    return this.users.updateMe(user.userId, dto);
  }
}
