import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  ApiEnvelopeResponse,
  ApiErrorResponses,
} from '../common/decorators/api-envelope.decorator';
import { AuthUser, CurrentUser } from '../common/decorators/auth.decorators';
import { SensitiveRateLimit } from '../common/guards/rate-limit';
import { UuidPipe } from '../common/pipes/uuid.pipe';
import { FamilyDto } from '../families/dto/family.dto';
import { CreatedInviteDto, CreateInviteDto, InviteDto, JoinFamilyDto } from './dto/invite.dto';
import { InvitesService } from './invites.service';

@ApiTags('Invites')
@ApiBearerAuth()
@Controller('families')
export class InvitesController {
  constructor(private readonly invites: InvitesService) {}

  @Post('current/invites')
  @ApiOperation({ summary: 'Create an invite code (OWNER/PARENT). The code is shown only once.' })
  @ApiEnvelopeResponse(CreatedInviteDto, { status: 201 })
  @ApiErrorResponses(400, 401, 403, 404)
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateInviteDto): Promise<CreatedInviteDto> {
    return this.invites.create(user.userId, dto);
  }

  @Get('current/invites')
  @ApiOperation({ summary: 'Active (unexpired, unused, unrevoked) invites' })
  @ApiEnvelopeResponse(InviteDto, { isArray: true })
  @ApiErrorResponses(401, 403, 404)
  list(@CurrentUser() user: AuthUser): Promise<InviteDto[]> {
    return this.invites.listActive(user.userId);
  }

  @Delete('current/invites/:id')
  @ApiOperation({ summary: 'Revoke an invite' })
  @ApiEnvelopeResponse(null)
  @ApiErrorResponses(400, 401, 403, 404)
  revoke(@CurrentUser() user: AuthUser, @Param('id', UuidPipe) id: string): Promise<null> {
    return this.invites.revoke(user.userId, id);
  }

  @Post('join')
  @SensitiveRateLimit()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Join a family with an invite code' })
  @ApiEnvelopeResponse(FamilyDto)
  @ApiErrorResponses(400, 401, 404, 409, 410, 429)
  join(@CurrentUser() user: AuthUser, @Body() dto: JoinFamilyDto): Promise<FamilyDto> {
    return this.invites.join(user.userId, dto.code);
  }
}
