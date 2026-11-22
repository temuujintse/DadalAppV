import { Global, Injectable, Module } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService, PrismaTx } from '../../database/prisma.service';

export const AuditAction = {
  USER_REGISTERED: 'USER_REGISTERED',
  SESSION_REUSE_DETECTED: 'SESSION_REUSE_DETECTED',
  PASSWORD_RESET_REQUESTED: 'PASSWORD_RESET_REQUESTED',
  PASSWORD_RESET_COMPLETED: 'PASSWORD_RESET_COMPLETED',
  FAMILY_CREATED: 'FAMILY_CREATED',
  FAMILY_UPDATED: 'FAMILY_UPDATED',
  FAMILY_DISSOLVED: 'FAMILY_DISSOLVED',
  MEMBER_JOINED: 'MEMBER_JOINED',
  MEMBER_LEFT: 'MEMBER_LEFT',
  MEMBER_REMOVED: 'MEMBER_REMOVED',
  MEMBER_ROLE_CHANGED: 'MEMBER_ROLE_CHANGED',
  OWNERSHIP_TRANSFERRED: 'OWNERSHIP_TRANSFERRED',
  INVITE_CREATED: 'INVITE_CREATED',
  INVITE_REVOKED: 'INVITE_REVOKED',
  HABIT_CREATED: 'HABIT_CREATED',
  HABIT_UPDATED: 'HABIT_UPDATED',
  HABIT_DELETED: 'HABIT_DELETED',
  HABIT_ASSIGNMENTS_CHANGED: 'HABIT_ASSIGNMENTS_CHANGED',
  QUEST_CLAIMED: 'QUEST_CLAIMED',
  REWARD_CREATED: 'REWARD_CREATED',
  REWARD_UPDATED: 'REWARD_UPDATED',
  REWARD_DELETED: 'REWARD_DELETED',
  REDEMPTION_REQUESTED: 'REDEMPTION_REQUESTED',
  REDEMPTION_APPROVED: 'REDEMPTION_APPROVED',
  REDEMPTION_REJECTED: 'REDEMPTION_REJECTED',
  REDEMPTION_COMPLETED: 'REDEMPTION_COMPLETED',
  REDEMPTION_CANCELLED: 'REDEMPTION_CANCELLED',
} as const;
export type AuditAction = (typeof AuditAction)[keyof typeof AuditAction];

export interface AuditEntry {
  action: AuditAction;
  entityType: string;
  entityId?: string;
  actorId?: string;
  familyId?: string;
  metadata?: Prisma.InputJsonValue;
  ip?: string;
}

/** Writes to the append-only AuditLog. Pass `tx` to record inside the caller's transaction. */
@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async record(entry: AuditEntry, tx?: PrismaTx): Promise<void> {
    await (tx ?? this.prisma).auditLog.create({ data: entry });
  }
}

@Global()
@Module({ providers: [AuditService], exports: [AuditService] })
export class AuditModule {}
