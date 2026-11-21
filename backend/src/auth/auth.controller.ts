import { Body, Controller, Get, HttpCode, HttpStatus, Post, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import {
  ApiEnvelopeResponse,
  ApiErrorResponses,
} from '../common/decorators/api-envelope.decorator';
import { AuthUser, CurrentUser, Public } from '../common/decorators/auth.decorators';
import { SensitiveRateLimit } from '../common/guards/rate-limit';
import { MeDto } from '../users/dto/me.dto';
import { UsersService } from '../users/users.service';
import { AuthService, ClientInfo } from './auth.service';
import { AuthResultDto, LoginDto, RefreshDto, RegisterDto, TokenPairDto } from './dto/auth.dto';

function clientInfo(req: Request): ClientInfo {
  return { userAgent: req.header('user-agent') ?? undefined, ip: req.ip };
}

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly users: UsersService,
  ) {}

  @Public()
  @SensitiveRateLimit()
  @Post('register')
  @ApiOperation({ summary: 'Create an account and start a session' })
  @ApiEnvelopeResponse(AuthResultDto, { status: 201 })
  @ApiErrorResponses(400, 409, 429)
  register(@Body() dto: RegisterDto, @Req() req: Request): Promise<AuthResultDto> {
    return this.auth.register(dto, clientInfo(req));
  }

  @Public()
  @SensitiveRateLimit()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Sign in with e-mail and password' })
  @ApiEnvelopeResponse(AuthResultDto)
  @ApiErrorResponses(400, 401, 429)
  login(@Body() dto: LoginDto, @Req() req: Request): Promise<AuthResultDto> {
    return this.auth.login(dto, clientInfo(req));
  }

  @Public()
  @SensitiveRateLimit()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Rotate the refresh token and issue a new access token' })
  @ApiEnvelopeResponse(TokenPairDto)
  @ApiErrorResponses(400, 401, 429)
  refresh(@Body() dto: RefreshDto, @Req() req: Request): Promise<TokenPairDto> {
    return this.auth.refresh(dto.refreshToken, clientInfo(req));
  }

  @ApiBearerAuth()
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Revoke the current session' })
  @ApiEnvelopeResponse(null)
  @ApiErrorResponses(401)
  async logout(@CurrentUser() user: AuthUser): Promise<null> {
    await this.auth.logout(user.sessionId);
    return null;
  }

  @ApiBearerAuth()
  @Get('me')
  @ApiOperation({ summary: 'Current user (alias of GET /users/me)' })
  @ApiEnvelopeResponse(MeDto)
  @ApiErrorResponses(401)
  me(@CurrentUser() user: AuthUser): Promise<MeDto> {
    return this.users.getMe(user.userId);
  }
}
