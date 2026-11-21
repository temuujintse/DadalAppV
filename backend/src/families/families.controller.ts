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
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  ApiEnvelopeResponse,
  ApiErrorResponses,
} from '../common/decorators/api-envelope.decorator';
import { AuthUser, CurrentUser } from '../common/decorators/auth.decorators';
import { UuidPipe } from '../common/pipes/uuid.pipe';
import {
  ChangeRoleDto,
  CreateFamilyDto,
  FamilyDto,
  FamilyMemberDto,
  LeaveResultDto,
  TransferOwnershipDto,
  UpdateFamilyDto,
} from './dto/family.dto';
import { FamiliesService } from './families.service';

@ApiTags('Families')
@ApiBearerAuth()
@Controller('families')
export class FamiliesController {
  constructor(private readonly families: FamiliesService) {}

  @Post()
  @ApiOperation({ summary: 'Create a family; the caller becomes OWNER' })
  @ApiEnvelopeResponse(FamilyDto, { status: 201 })
  @ApiErrorResponses(400, 401, 409)
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateFamilyDto): Promise<FamilyDto> {
    return this.families.create(user.userId, dto);
  }

  @Get('current')
  @ApiOperation({ summary: "The caller's family (404 NOT_IN_FAMILY when none)" })
  @ApiEnvelopeResponse(FamilyDto)
  @ApiErrorResponses(401, 404)
  current(@CurrentUser() user: AuthUser): Promise<FamilyDto> {
    return this.families.getCurrent(user.userId);
  }

  @Patch('current')
  @ApiOperation({ summary: 'Update family name, avatar or timezone (OWNER/PARENT)' })
  @ApiEnvelopeResponse(FamilyDto)
  @ApiErrorResponses(400, 401, 403, 404)
  update(@CurrentUser() user: AuthUser, @Body() dto: UpdateFamilyDto): Promise<FamilyDto> {
    return this.families.update(user.userId, dto);
  }

  @Get('current/members')
  @ApiOperation({ summary: 'Members of the caller’s family' })
  @ApiEnvelopeResponse(FamilyMemberDto, { isArray: true })
  @ApiErrorResponses(401, 404)
  members(@CurrentUser() user: AuthUser): Promise<FamilyMemberDto[]> {
    return this.families.listMembers(user.userId);
  }

  @Patch('current/members/:id')
  @ApiOperation({ summary: 'Change a member’s role (OWNER only; OWNER role via transfer)' })
  @ApiEnvelopeResponse(FamilyMemberDto, { isArray: true })
  @ApiErrorResponses(400, 401, 403, 404)
  changeRole(
    @CurrentUser() user: AuthUser,
    @Param('id', UuidPipe) memberId: string,
    @Body() dto: ChangeRoleDto,
  ): Promise<FamilyMemberDto[]> {
    return this.families.changeRole(user.userId, memberId, dto);
  }

  @Delete('current/members/:id')
  @ApiOperation({
    summary: 'Remove a member, or leave the family when :id is the caller’s own member id',
  })
  @ApiEnvelopeResponse(LeaveResultDto)
  @ApiErrorResponses(400, 401, 403, 404, 409)
  remove(
    @CurrentUser() user: AuthUser,
    @Param('id', UuidPipe) memberId: string,
  ): Promise<LeaveResultDto> {
    return this.families.removeMember(user.userId, memberId);
  }

  @Post('current/transfer-ownership')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Hand OWNER over to another member; caller becomes PARENT' })
  @ApiEnvelopeResponse(FamilyMemberDto, { isArray: true })
  @ApiErrorResponses(400, 401, 403, 404)
  transfer(
    @CurrentUser() user: AuthUser,
    @Body() dto: TransferOwnershipDto,
  ): Promise<FamilyMemberDto[]> {
    return this.families.transferOwnership(user.userId, dto.memberId);
  }
}
