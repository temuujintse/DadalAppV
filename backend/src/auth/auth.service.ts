import { Injectable } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import { AuditAction, AuditService } from '../common/audit/audit.service';
import { AppException } from '../common/errors/app.exception';
import { ErrorCode } from '../common/errors/error-codes';
import { DEFAULT_TIMEZONE } from '../common/utils/timezone.util';
import { PrismaService } from '../database/prisma.service';
import { UsersService } from '../users/users.service';
import { AuthResultDto, LoginDto, RegisterDto } from './dto/auth.dto';
import { PasswordService } from './password.service';
import { TokenPair, TokenService } from './token.service';

export interface ClientInfo {
  userAgent?: string;
  ip?: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwords: PasswordService,
    private readonly tokens: TokenService,
    private readonly users: UsersService,
    private readonly audit: AuditService,
  ) {}

  async register(dto: RegisterDto, client: ClientInfo): Promise<AuthResultDto> {
    const passwordHash = await this.passwords.hash(dto.password);

    let userId: string;
    try {
      userId = await this.prisma.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            email: dto.email,
            passwordHash,
            profile: {
              create: {
                displayName: dto.displayName,
                avatarKey: dto.avatarKey ?? 'fox',
                timezone: dto.timezone ?? DEFAULT_TIMEZONE,
              },
            },
            gamification: { create: {} },
          },
        });
        await this.audit.record(
          {
            action: AuditAction.USER_REGISTERED,
            entityType: 'User',
            entityId: user.id,
            actorId: user.id,
            ip: client.ip,
          },
          tx,
        );
        return user.id;
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw AppException.conflict(ErrorCode.EMAIL_TAKEN, 'Энэ имэйл хаяг бүртгэлтэй байна.');
      }
      throw err;
    }

    const tokens = await this.tokens.createSession(userId, client.userAgent);
    return { user: await this.users.getMe(userId), tokens };
  }

  async login(dto: LoginDto, client: ClientInfo): Promise<AuthResultDto> {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    // Always run a hash verification so response time does not reveal whether the e-mail exists.
    const valid = await this.passwords.verify(user?.passwordHash, dto.password);
    if (!user || !valid || user.deletedAt || user.status !== 'ACTIVE') {
      throw AppException.unauthorized(
        ErrorCode.INVALID_CREDENTIALS,
        'Имэйл эсвэл нууц үг буруу байна.',
      );
    }

    await this.prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    const tokens = await this.tokens.createSession(user.id, client.userAgent);
    return { user: await this.users.getMe(user.id), tokens };
  }

  refresh(refreshToken: string, client: ClientInfo): Promise<TokenPair> {
    return this.tokens.rotate(refreshToken, client.userAgent);
  }

  async logout(sessionId: string): Promise<void> {
    await this.tokens.revokeSession(sessionId, 'LOGOUT');
  }
}
