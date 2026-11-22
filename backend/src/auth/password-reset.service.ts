import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomInt } from 'node:crypto';
import { AuditAction, AuditService } from '../common/audit/audit.service';
import { AppException } from '../common/errors/app.exception';
import { ErrorCode } from '../common/errors/error-codes';
import { hmacSha256, safeEqualHex } from '../common/utils/crypto.util';
import type { Env } from '../config/env';
import { PrismaService } from '../database/prisma.service';
import { MailService } from '../mail/mail.service';
import { PasswordService } from './password.service';

const MAX_ATTEMPTS = 5;
const INVALID = 'Код буруу эсвэл хугацаа нь дууссан байна. Шинэ код авна уу.';

/**
 * Password reset with a 6-digit e-mailed code.
 * - The request answers the same whether or not the e-mail exists (no account enumeration).
 * - Only an HMAC of the code is stored; 5 wrong tries or the TTL invalidate it.
 * - A new request replaces older codes; a successful reset signs out every session.
 */
@Injectable()
export class PasswordResetService {
  private readonly logger = new Logger(PasswordResetService.name);
  private readonly pepper: string;
  private readonly ttlMs: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly passwords: PasswordService,
    private readonly mail: MailService,
    private readonly audit: AuditService,
    config: ConfigService<Env, true>,
  ) {
    this.pepper = config.get('INVITE_TOKEN_SECRET', { infer: true });
    this.ttlMs = config.get('PASSWORD_RESET_TTL_MINUTES', { infer: true }) * 60_000;
  }

  private hash(userId: string, code: string): string {
    return hmacSha256(this.pepper, `password-reset:${userId}:${code}`);
  }

  async request(email: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: { profile: { select: { displayName: true } } },
    });
    if (!user || user.deletedAt || user.status !== 'ACTIVE') return;

    const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
    const now = new Date();
    await this.prisma.$transaction(async (tx) => {
      await tx.passwordReset.updateMany({
        where: { userId: user.id, usedAt: null },
        data: { usedAt: now },
      });
      await tx.passwordReset.create({
        data: {
          userId: user.id,
          codeHash: this.hash(user.id, code),
          expiresAt: new Date(now.getTime() + this.ttlMs),
        },
      });
      await this.audit.record(
        {
          action: AuditAction.PASSWORD_RESET_REQUESTED,
          entityType: 'User',
          entityId: user.id,
          actorId: user.id,
        },
        tx,
      );
    });

    const minutes = Math.round(this.ttlMs / 60_000);
    const name = user.profile?.displayName ?? '';
    const sent = await this.mail.send({
      to: user.email,
      subject: `Family Habit — нууц үг сэргээх код: ${code}`,
      text:
        `Сайн байна уу${name ? `, ${name}` : ''}!\n\n` +
        `Нууц үг сэргээх код: ${code}\n` +
        `Код ${minutes} минутын турш хүчинтэй.\n\n` +
        'Хэрэв та хүсэлт гаргаагүй бол энэ имэйлийг үл тоомсорлоно уу — нууц үг өөрчлөгдөхгүй.',
      html:
        `<p>Сайн байна уу${name ? `, ${escapeHtml(name)}` : ''}!</p>` +
        `<p>Нууц үг сэргээх код:</p><p style="font-size:28px;font-weight:700;letter-spacing:6px">${code}</p>` +
        `<p>Код ${minutes} минутын турш хүчинтэй.</p>` +
        '<p style="color:#64748B">Хэрэв та хүсэлт гаргаагүй бол энэ имэйлийг үл тоомсорлоно уу — нууц үг өөрчлөгдөхгүй.</p>',
    });
    if (!sent) this.logger.warn(`Password reset code for user ${user.id} was not delivered`);
  }

  async reset(email: string, code: string, newPassword: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    const active = user
      ? await this.prisma.passwordReset.findFirst({
          where: { userId: user.id, usedAt: null, expiresAt: { gt: new Date() } },
          orderBy: { createdAt: 'desc' },
        })
      : null;
    if (!user || !active || active.attempts >= MAX_ATTEMPTS) {
      throw AppException.badRequest(ErrorCode.RESET_CODE_INVALID, INVALID);
    }

    if (!safeEqualHex(active.codeHash, this.hash(user.id, code))) {
      // Conditional increment: concurrent guesses cannot exceed the attempt budget.
      await this.prisma.passwordReset.updateMany({
        where: { id: active.id, attempts: { lt: MAX_ATTEMPTS } },
        data: { attempts: { increment: 1 } },
      });
      throw AppException.badRequest(ErrorCode.RESET_CODE_INVALID, INVALID);
    }

    const passwordHash = await this.passwords.hash(newPassword);
    const now = new Date();
    await this.prisma.$transaction(async (tx) => {
      // Claim the code exactly once.
      const claimed = await tx.passwordReset.updateMany({
        where: { id: active.id, usedAt: null },
        data: { usedAt: now },
      });
      if (claimed.count !== 1) throw AppException.badRequest(ErrorCode.RESET_CODE_INVALID, INVALID);
      await tx.user.update({ where: { id: user.id }, data: { passwordHash } });
      await tx.authSession.updateMany({
        where: { userId: user.id, revokedAt: null },
        data: { revokedAt: now, revokeReason: 'PASSWORD_RESET' },
      });
      await this.audit.record(
        {
          action: AuditAction.PASSWORD_RESET_COMPLETED,
          entityType: 'User',
          entityId: user.id,
          actorId: user.id,
        },
        tx,
      );
    });
  }
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}
