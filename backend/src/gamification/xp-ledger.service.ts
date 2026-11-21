import { Injectable } from '@nestjs/common';
import { AppException } from '../common/errors/app.exception';
import { ErrorCode } from '../common/errors/error-codes';
import { PrismaTx } from '../database/prisma.service';
import { Prisma } from '../generated/prisma/client';
import { XPSourceType, XPTransactionKind } from '../generated/prisma/enums';
import { levelFromXp, LevelProgress } from './level';

export interface WalletState extends LevelProgress {
  lifetimeXP: number;
  /** Spendable XP (personal wallet only; equals lifetime for family) */
  balanceXP: number;
  leveledUp: boolean;
}

interface BaseEntry {
  kind: XPTransactionKind;
  /** Positive for EARN, negative for SPEND / REVERSAL. */
  amount: number;
  sourceType: XPSourceType;
  sourceId?: string;
  /** Server-generated; the same key can never be applied twice. */
  idempotencyKey: string;
  actorId?: string;
  metadata?: Prisma.InputJsonValue;
}

/**
 * The only writer of XP. Every change is an append-only XPTransaction row plus an aggregate
 * update in the same DB transaction. Must always be called with the caller's `tx`.
 */
@Injectable()
export class XpLedgerService {
  /** Personal wallet. Returns null when the idempotency key was already applied. */
  async postPersonal(tx: PrismaTx, userId: string, entry: BaseEntry): Promise<WalletState | null> {
    const before = await tx.userGamification.upsert({
      where: { userId },
      create: { userId },
      update: {},
    });
    if (before.balanceXP + entry.amount < 0) {
      throw AppException.conflict(
        ErrorCode.XP_ALREADY_SPENT,
        'Энэ XP аль хэдийн шагналд зарцуулагдсан тул буцаах боломжгүй.',
      );
    }
    if (!(await this.insert(tx, { ...entry, walletType: 'PERSONAL', userId }))) return null;

    const lifetimeDelta = entry.kind === 'SPEND' ? 0 : entry.amount;
    const lifetimeXP = Math.max(0, before.lifetimeXP + lifetimeDelta);
    const progress = levelFromXp(lifetimeXP);
    const after = await tx.userGamification.update({
      where: { userId },
      data: {
        lifetimeXP: { increment: lifetimeXP - before.lifetimeXP },
        balanceXP: { increment: entry.amount },
        level: progress.level,
      },
    });
    return {
      ...levelFromXp(after.lifetimeXP),
      lifetimeXP: after.lifetimeXP,
      balanceXP: after.balanceXP,
      leveledUp: after.level > before.level,
    };
  }

  /** Family wallet (shared progress, never spent). */
  async postFamily(tx: PrismaTx, familyId: string, entry: BaseEntry): Promise<WalletState | null> {
    const before = await tx.familyGamification.upsert({
      where: { familyId },
      create: { familyId },
      update: {},
    });
    if (!(await this.insert(tx, { ...entry, walletType: 'FAMILY', familyId }))) return null;

    const lifetimeXP = Math.max(0, before.lifetimeXP + entry.amount);
    const progress = levelFromXp(lifetimeXP);
    const after = await tx.familyGamification.update({
      where: { familyId },
      data: { lifetimeXP: { increment: lifetimeXP - before.lifetimeXP }, level: progress.level },
    });
    return {
      ...levelFromXp(after.lifetimeXP),
      lifetimeXP: after.lifetimeXP,
      balanceXP: after.lifetimeXP,
      leveledUp: after.level > before.level,
    };
  }

  /** Pet wallet. Pet level is derived from pet lifetime XP (same curve as personal levels). */
  async postPet(tx: PrismaTx, petId: string, entry: BaseEntry): Promise<WalletState | null> {
    const before = await tx.userPet.findUniqueOrThrow({ where: { id: petId } });
    if (!(await this.insert(tx, { ...entry, walletType: 'PET', petId }))) return null;

    const lifetimeXP = Math.max(0, before.lifetimeXP + entry.amount);
    const progress = levelFromXp(lifetimeXP);
    const after = await tx.userPet.update({
      where: { id: petId },
      data: { lifetimeXP: { increment: lifetimeXP - before.lifetimeXP }, level: progress.level },
    });
    return {
      ...levelFromXp(after.lifetimeXP),
      lifetimeXP: after.lifetimeXP,
      balanceXP: after.lifetimeXP,
      leveledUp: after.level > before.level,
    };
  }

  async personalState(tx: PrismaTx, userId: string): Promise<WalletState> {
    const row = await tx.userGamification.findUnique({ where: { userId } });
    const lifetimeXP = row?.lifetimeXP ?? 0;
    return {
      ...levelFromXp(lifetimeXP),
      lifetimeXP,
      balanceXP: row?.balanceXP ?? 0,
      leveledUp: false,
    };
  }

  async familyState(tx: PrismaTx, familyId: string): Promise<WalletState> {
    const row = await tx.familyGamification.findUnique({ where: { familyId } });
    const lifetimeXP = row?.lifetimeXP ?? 0;
    return { ...levelFromXp(lifetimeXP), lifetimeXP, balanceXP: lifetimeXP, leveledUp: false };
  }

  /** Inserts the ledger row; `false` when the idempotency key already exists (no-op). */
  private async insert(
    tx: PrismaTx,
    data: BaseEntry & {
      walletType: 'PERSONAL' | 'FAMILY' | 'PET';
      userId?: string;
      familyId?: string;
      petId?: string;
    },
  ): Promise<boolean> {
    // ON CONFLICT DO NOTHING keeps the surrounding transaction usable on duplicates.
    const result = await tx.xPTransaction.createMany({
      data: [
        {
          walletType: data.walletType,
          kind: data.kind,
          userId: data.userId,
          familyId: data.familyId,
          petId: data.petId,
          amount: data.amount,
          sourceType: data.sourceType,
          sourceId: data.sourceId,
          idempotencyKey: data.idempotencyKey,
          actorId: data.actorId,
          metadata: data.metadata,
        },
      ],
      skipDuplicates: true,
    });
    return result.count === 1;
  }
}
