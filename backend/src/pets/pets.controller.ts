import {
  Body,
  Controller,
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
import { Paginated } from '../common/dto/paginated';
import { UuidPipe } from '../common/pipes/uuid.pipe';
import {
  AccessoryDto,
  CareDto,
  CareResultDto,
  PetDto,
  PetHistoryItemDto,
  PetHistoryQueryDto,
  UpdatePetDto,
} from './dto/pet.dto';
import { PetsService } from './pets.service';

@ApiTags('Pet')
@ApiBearerAuth()
@Controller('pet/me')
export class PetsController {
  constructor(private readonly pets: PetsService) {}

  @Get()
  @ApiOperation({ summary: 'My pet (created on first access)' })
  @ApiEnvelopeResponse(PetDto)
  @ApiErrorResponses(401)
  me(@CurrentUser() user: AuthUser): Promise<PetDto> {
    return this.pets.getMe(user.userId);
  }

  @Patch()
  @ApiOperation({ summary: 'Rename the pet or change its look' })
  @ApiEnvelopeResponse(PetDto)
  @ApiErrorResponses(400, 401)
  update(@CurrentUser() user: AuthUser, @Body() dto: UpdatePetDto): Promise<PetDto> {
    return this.pets.update(user.userId, dto);
  }

  @Post('care')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Care action (PET / FEED / PLAY / BATH) with cooldown; idempotent per key',
  })
  @ApiEnvelopeResponse(CareResultDto)
  @ApiErrorResponses(400, 401, 429)
  care(@CurrentUser() user: AuthUser, @Body() dto: CareDto): Promise<CareResultDto> {
    return this.pets.care(user.userId, dto.type, dto.idempotencyKey);
  }

  @Get('accessories')
  @ApiOperation({ summary: 'Accessory catalog with unlock state and progress' })
  @ApiEnvelopeResponse(AccessoryDto, { isArray: true })
  @ApiErrorResponses(401)
  accessories(@CurrentUser() user: AuthUser): Promise<AccessoryDto[]> {
    return this.pets.listAccessories(user.userId);
  }

  @Post('accessories/:id/equip')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Equip an unlocked accessory (replaces the item in the same slot)' })
  @ApiEnvelopeResponse(PetDto)
  @ApiErrorResponses(400, 401, 403, 404)
  equip(@CurrentUser() user: AuthUser, @Param('id', UuidPipe) id: string): Promise<PetDto> {
    return this.pets.equip(user.userId, id);
  }

  @Post('accessories/:id/unequip')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Take an accessory off' })
  @ApiEnvelopeResponse(PetDto)
  @ApiErrorResponses(400, 401, 403, 404)
  unequip(@CurrentUser() user: AuthUser, @Param('id', UuidPipe) id: string): Promise<PetDto> {
    return this.pets.unequip(user.userId, id);
  }

  @Get('history')
  @ApiOperation({ summary: 'Pet XP history (newest first)' })
  @ApiEnvelopeResponse(PetHistoryItemDto, { isArray: true })
  @ApiErrorResponses(400, 401)
  history(
    @CurrentUser() user: AuthUser,
    @Query() query: PetHistoryQueryDto,
  ): Promise<Paginated<PetHistoryItemDto>> {
    return this.pets.history(user.userId, query);
  }
}
