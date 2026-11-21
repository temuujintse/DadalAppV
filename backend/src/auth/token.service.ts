import { HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { AuditAction, AuditService } from '../common/audit/audit.service';
import { AppException } from '../common/errors/app.exception';
import { ErrorCode } from '../common/errors/error-codes';
import { randomToken, safeEqualHex, sha256 } from '../common/utils/crypto.util';
import type { Env } from '../config/env';
import { PrismaService } from '../database/prisma.service';

export const JWT_ISSUER = 'family-habit-api';
export const JWT_AUDIENCE = 'family-habit-app';

export interface AccessTokenPayload {
  sub: string;
  sid: string;
}

export interface TokenPair {
  accessToken: string;
  accessTokenExpiresAt: string;
  refreshToken: string;
  refreshTokenExpiresAt: string;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Session + token lifecycle.
 * - Access token: short-lived JWT carrying { sub, sid }.
 * - Refresh token: opaque "<sessionId>.<secret>", rotated on every use, stored as SHA-256 hash.
 * - Presenting an already-rotated refresh token revokes the whole session (theft detection).
 */
@Injectable()
export class TokenService {
  private readonly accessTtlSeconds: number;
  private readonly refreshTtlMs: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly audit: AuditService,
    config: ConfigService<Env, true>,
  ) {
    this.accessTtlSeconds = config.get('JWT_ACCESS_TTL_SECONDS', { infer: true });
    this.refreshTtlMs = config.get('REFRESH_TOKEN_TTL_DAYS', { infer: true }) * 24 * 60 * 60 * 1000;
  }

  async createSession(userId: string, userAgent?: string): Promise<TokenPair> {
    const secret = randomToken(32);
    const expiresAt = new Date(Date.now() + this.refreshTtlMs);
    const session = await this.prisma.authSession.create({
      data: {
        userId,
        refreshTokenHash: sha256(secret),
        userAgent: userAgent?.slice(0, 255),
        expiresAt,
      },
    });
    return this.buildPair(userId, session.id, secret, expiresAt);
  }

  async rotate(refreshToken: string, userAgent?: string): Promise<TokenPair> {
    const parsed = this.parseRefreshToken(refreshToken);
    if (!parsed) throw this.invalidToken();

    const session = await this.prisma.authSession.findUnique({
      where: { id: parsed.sessionId },
      include: { user: { select: { status: true, deletedAt: true } } },
    });
    if (!session) throw this.invalidToken();
    if (session.revokedAt || session.expiresAt.getTime() <= Date.now()) throw this.revoked();

    const presentedHash = sha256(parsed.secret);
    if (!safeEqualHex(presentedHash, session.refreshTokenHash)) {
      // An old refresh token was replayed → assume it leaked and kill the session.
      await this.revokeSession(session.id, 'REUSE_DETECTED');
      await this.audit.record({
        action: AuditAction.SESSION_REUSE_DETECTED,
        entityType: 'AuthSession',
        entityId: session.id,
        actorId: session.userId,
      });
      throw this.revoked();
    }
    if (session.user.status !== 'ACTIVE' || session.user.deletedAt) throw this.revoked();

    const secret = randomToken(32);
    const expiresAt = new Date(Date.now() + this.refreshTtlMs);
    // Compare-and-swap on the stored hash so two concurrent refreshes cannot both succeed.
    const updated = await this.prisma.authSession.updateMany({
      where: { id: session.id, refreshTokenHash: session.refreshTokenHash, revokedAt: null },
      data: {
        refreshTokenHash: sha256(secret),
        lastUsedAt: new Date(),
        expiresAt,
        userAgent: userAgent?.slice(0, 255) ?? session.userAgent,
      },
    });
    if (updated.count !== 1) throw this.invalidToken();

    return this.buildPair(session.userId, session.id, secret, expiresAt);
  }

  async revokeSession(sessionId: string, reason: string): Promise<void> {
    await this.prisma.authSession.updateMany({
      where: { id: sessionId, revokedAt: null },
      data: { revokedAt: new Date(), revokeReason: reason },
    });
  }

  async verifyAccessToken(token: string): Promise<AccessTokenPayload> {
    try {
      const payload = await this.jwt.verifyAsync<AccessTokenPayload>(token, {
        issuer: JWT_ISSUER,
        audience: JWT_AUDIENCE,
        algorithms: ['HS256'],
      });
      if (!UUID_RE.test(payload.sub) || !UUID_RE.test(payload.sid)) throw new Error('bad claims');
      return payload;
    } catch {
      throw AppException.unauthorized(ErrorCode.TOKEN_INVALID, 'Нэвтрэх хугацаа дууссан байна.');
    }
  }

  private async buildPair(
    userId: string,
    sessionId: string,
    secret: string,
    refreshExpiresAt: Date,
  ): Promise<TokenPair> {
    const payload: AccessTokenPayload = { sub: userId, sid: sessionId };
    const accessToken = await this.jwt.signAsync(payload, {
      expiresIn: this.accessTtlSeconds,
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
      algorithm: 'HS256',
    });
    return {
      accessToken,
      accessTokenExpiresAt: new Date(Date.now() + this.accessTtlSeconds * 1000).toISOString(),
      refreshToken: `${sessionId}.${secret}`,
      refreshTokenExpiresAt: refreshExpiresAt.toISOString(),
    };
  }

  private parseRefreshToken(token: string): { sessionId: string; secret: string } | null {
    if (typeof token !== 'string' || token.length > 200) return null;
    const dot = token.indexOf('.');
    if (dot <= 0) return null;
    const sessionId = token.slice(0, dot);
    const secret = token.slice(dot + 1);
    if (!UUID_RE.test(sessionId) || secret.length < 20) return null;
    return { sessionId, secret };
  }

  private invalidToken() {
    return AppException.unauthorized(ErrorCode.TOKEN_INVALID, 'Нэвтрэх хугацаа дууссан байна.');
  }

  private revoked() {
    return new AppException(
      HttpStatus.UNAUTHORIZED,
      ErrorCode.SESSION_REVOKED,
      'Таны нэвтрэлт хүчингүй болсон байна. Дахин нэвтэрнэ үү.',
    );
  }
}
