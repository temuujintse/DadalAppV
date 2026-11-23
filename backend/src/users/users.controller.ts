import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Put,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  ApiEnvelopeResponse,
  ApiErrorResponses,
} from '../common/decorators/api-envelope.decorator';
import { AuthUser, CurrentUser } from '../common/decorators/auth.decorators';
import { UuidPipe } from '../common/pipes/uuid.pipe';
import { MeDto, UpdateMeDto, UploadPhotoDto } from './dto/me.dto';
import { PhotosService } from './photos.service';
import { UsersService } from './users.service';

@ApiTags('Users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(
    private readonly users: UsersService,
    private readonly photos: PhotosService,
  ) {}

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

  @Put('me/photo')
  @ApiOperation({ summary: 'Upload / replace the profile photo (base64 JPEG/PNG/WebP, ≤ 64 KB)' })
  @ApiEnvelopeResponse(MeDto)
  @ApiErrorResponses(400, 401, 413)
  uploadPhoto(@CurrentUser() user: AuthUser, @Body() dto: UploadPhotoDto): Promise<MeDto> {
    return this.photos.upload(user.userId, dto.image);
  }

  @Delete('me/photo')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Remove the profile photo (the preset avatar is shown again)' })
  @ApiEnvelopeResponse(MeDto)
  @ApiErrorResponses(401)
  removePhoto(@CurrentUser() user: AuthUser): Promise<MeDto> {
    return this.photos.remove(user.userId);
  }

  @Get(':id/photo')
  @ApiOperation({ summary: 'Profile photo bytes (yourself or a member of your family)' })
  @ApiErrorResponses(401, 404)
  async photo(
    @CurrentUser() user: AuthUser,
    @Param('id', UuidPipe) id: string,
    @Res() res: Response,
  ): Promise<void> {
    const p = await this.photos.read(user.userId, id);
    res
      .status(200)
      .set({
        'Content-Type': p.mime,
        'Content-Length': String(p.data.length),
        // URLs carry ?v=<version>, so a private long cache is safe.
        'Cache-Control': 'private, max-age=31536000, immutable',
        'Last-Modified': p.updatedAt.toUTCString(),
      })
      .send(p.data);
  }
}
