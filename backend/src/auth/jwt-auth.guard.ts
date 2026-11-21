import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { AuthenticatedRequest, IS_PUBLIC_KEY } from '../common/decorators/auth.decorators';
import { AppException } from '../common/errors/app.exception';
import { ErrorCode } from '../common/errors/error-codes';
import { PrismaService } from '../database/prisma.service';
import { TokenService } from './token.service';

/**
 * Global guard: every route requires a valid access token unless marked @Public().
 * The session is checked on each request so logout / reuse-detection take effect immediately.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly tokens: TokenService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const req = context.switchToHttp().getRequest<Request & AuthenticatedRequest>();
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
      throw AppException.unauthorized(ErrorCode.UNAUTHORIZED, 'Нэвтрэх шаардлагатай.');
    }

    const payload = await this.tokens.verifyAccessToken(header.slice(7).trim());

    const session = await this.prisma.authSession.findUnique({
      where: { id: payload.sid },
      select: {
        userId: true,
        revokedAt: true,
        expiresAt: true,
        user: { select: { status: true, deletedAt: true } },
      },
    });
    if (
      !session ||
      session.userId !== payload.sub ||
      session.revokedAt ||
      session.expiresAt.getTime() <= Date.now() ||
      session.user.status !== 'ACTIVE' ||
      session.user.deletedAt
    ) {
      throw AppException.unauthorized(
        ErrorCode.SESSION_REVOKED,
        'Таны нэвтрэлт хүчингүй болсон байна. Дахин нэвтэрнэ үү.',
      );
    }

    req.user = { userId: payload.sub, sessionId: payload.sid };
    return true;
  }
}
