import { Injectable, Logger } from '@nestjs/common';
import { Paginated, PaginationQueryDto } from '../common/dto/paginated';
import { AppException } from '../common/errors/app.exception';
import { ErrorCode } from '../common/errors/error-codes';
import { PrismaService } from '../database/prisma.service';
import { can, FamilyPermission } from '../families/family-policy';
import { Notification, Prisma } from '../generated/prisma/client';
import { NotificationType, PushPlatform } from '../generated/prisma/enums';
import { NotificationDto } from './dto/notification.dto';
import { PushService } from './push.service';

interface Payload {
  type: NotificationType;
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

/**
 * In-app inbox + push for family events. Events are published after the business transaction
 * committed and never fail the caller (notifications are a side effect, not a requirement).
 * Habit reminders are local notifications scheduled on the device (they work offline).
 */
@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  private readonly pending = new Set<Promise<void>>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly push: PushService,
  ) {}

  // ───────────── Devices ─────────────

  async registerToken(userId: string, token: string, platform: PushPlatform): Promise<void> {
    // A device belongs to whoever signed in on it last.
    await this.prisma.pushToken.upsert({
      where: { token },
      create: { userId, token, platform },
      update: { userId, platform },
    });
  }

  async removeToken(userId: string, token: string): Promise<void> {
    await this.prisma.pushToken.deleteMany({ where: { userId, token } });
  }

  // ───────────── Inbox ─────────────

  async list(userId: string, query: PaginationQueryDto): Promise<Paginated<NotificationDto>> {
    const where = { userId };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: query.skip,
        take: query.limit,
      }),
      this.prisma.notification.count({ where }),
    ]);
    return new Paginated(rows.map(toDto), total, query);
  }

  unreadCount(userId: string): Promise<number> {
    return this.prisma.notification.count({ where: { userId, readAt: null } });
  }

  async markRead(userId: string, id: string): Promise<NotificationDto> {
    const found = await this.prisma.notification.findFirst({ where: { id, userId } });
    if (!found) throw AppException.notFound(ErrorCode.NOT_FOUND, 'Мэдэгдэл олдсонгүй.');
    if (found.readAt) return toDto(found);
    return toDto(
      await this.prisma.notification.update({ where: { id }, data: { readAt: new Date() } }),
    );
  }

  async markAllRead(userId: string): Promise<number> {
    const r = await this.prisma.notification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    });
    return r.count;
  }

  // ───────────── Events ─────────────

  memberJoined(familyId: string, newUserId: string): void {
    this.publish(async () => {
      const name = await this.displayName(newUserId);
      const others = await this.familyUserIds(familyId, newUserId);
      await this.notify(others, {
        type: 'FAMILY_ACTIVITY',
        title: 'Шинэ гишүүн нэгдлээ 👋',
        body: `${name} гэр бүлд нэгдлээ. Хамтдаа дадал хэвшүүлээрэй!`,
        data: { route: '/family' },
      });
    });
  }

  sharedHabitCompleted(familyId: string, actorId: string, habitId: string, title: string): void {
    this.publish(async () => {
      const name = await this.displayName(actorId);
      const others = await this.familyUserIds(familyId, actorId);
      await this.notify(others, {
        type: 'FAMILY_ACTIVITY',
        title: 'Гэр бүлийн дадал биелэв ✅',
        body: `${name} «${title}»-ийг гэр бүлийн өмнөөс биелүүллээ.`,
        data: { route: `/habit/${habitId}`, habitId },
      });
    });
  }

  redemptionRequested(familyId: string, requesterId: string, rewardTitle: string): void {
    this.publish(async () => {
      const name = await this.displayName(requesterId);
      const members = await this.prisma.familyMember.findMany({
        where: { familyId, userId: { not: requesterId } },
        select: { userId: true, role: true },
      });
      const managers = members
        .filter((m) => can(m.role, FamilyPermission.DECIDE_REDEMPTIONS))
        .map((m) => m.userId);
      await this.notify(managers, {
        type: 'REWARD_REQUESTED',
        title: 'Шагналын хүсэлт 🎁',
        body: `${name} «${rewardTitle}» шагнал авах хүсэлт илгээлээ.`,
        data: { route: '/rewards' },
      });
    });
  }

  redemptionDecided(requesterId: string, approved: boolean, rewardTitle: string): void {
    this.publish(() =>
      this.notify([requesterId], {
        type: approved ? 'REWARD_APPROVED' : 'REWARD_REJECTED',
        title: approved ? 'Шагнал зөвшөөрөгдлөө 🎉' : 'Шагналын хүсэлт',
        body: approved
          ? `«${rewardTitle}» шагналыг тань зөвшөөрлөө!`
          : `«${rewardTitle}» хүсэлтийг энэ удаад зөвшөөрсөнгүй. XP тань хэвээрээ.`,
        data: { route: '/rewards' },
      }),
    );
  }

  /** Test helper: wait until queued events are written and pushed. */
  async flush(): Promise<void> {
    while (this.pending.size) await Promise.all([...this.pending]);
  }

  // ───────────── Internals ─────────────

  private publish(task: () => Promise<void>): void {
    const p = task()
      .catch((err: unknown) => this.logger.warn(`Notification failed: ${String(err)}`))
      .finally(() => this.pending.delete(p));
    this.pending.add(p);
  }

  private async notify(userIds: string[], payload: Payload): Promise<void> {
    if (!userIds.length) return;
    await this.prisma.notification.createMany({
      data: userIds.map((userId) => ({
        userId,
        type: payload.type,
        title: payload.title,
        body: payload.body,
        data: (payload.data ?? Prisma.JsonNull) as Prisma.InputJsonValue,
      })),
    });
    await this.push.sendToUsers(userIds, {
      title: payload.title,
      body: payload.body,
      data: payload.data,
    });
  }

  private async familyUserIds(familyId: string, exceptUserId: string): Promise<string[]> {
    const rows = await this.prisma.familyMember.findMany({
      where: { familyId, userId: { not: exceptUserId } },
      select: { userId: true },
    });
    return rows.map((r) => r.userId);
  }

  private async displayName(userId: string): Promise<string> {
    const p = await this.prisma.userProfile.findUnique({
      where: { userId },
      select: { displayName: true },
    });
    return p?.displayName ?? 'Гэр бүлийн гишүүн';
  }
}

function toDto(n: Notification): NotificationDto {
  return {
    id: n.id,
    type: n.type,
    title: n.title,
    body: n.body,
    data: (n.data as Record<string, unknown> | null) ?? null,
    readAt: n.readAt?.toISOString() ?? null,
    createdAt: n.createdAt.toISOString(),
  };
}
