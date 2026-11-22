import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../config/env';
import { PrismaService } from '../database/prisma.service';

export interface PushMessage {
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

interface ExpoTicket {
  status: 'ok' | 'error';
  details?: { error?: string };
}

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const BATCH = 100;

/**
 * Delivers push notifications through Expo's push service (APNs / FCM behind it).
 * Delivery is best effort and never throws; tokens Expo reports as unregistered are removed.
 * Tests (NODE_ENV=test) record messages in `outbox` instead of calling Expo.
 */
@Injectable()
export class PushService {
  private readonly logger = new Logger(PushService.name);
  readonly outbox: { to: string; message: PushMessage }[] = [];
  private readonly isTest: boolean;
  private readonly accessToken?: string;

  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService<Env, true>,
  ) {
    this.isTest = config.get('NODE_ENV', { infer: true }) === 'test';
    this.accessToken = config.get('EXPO_ACCESS_TOKEN', { infer: true });
  }

  async sendToUsers(userIds: string[], message: PushMessage): Promise<void> {
    if (!userIds.length) return;
    const tokens = await this.prisma.pushToken.findMany({
      where: { userId: { in: userIds } },
      select: { token: true },
    });
    const to = tokens.map((t) => t.token);
    if (this.isTest) {
      to.forEach((t) => this.outbox.push({ to: t, message }));
      return;
    }
    for (let i = 0; i < to.length; i += BATCH) {
      await this.sendBatch(to.slice(i, i + BATCH), message);
    }
  }

  private async sendBatch(tokens: string[], message: PushMessage): Promise<void> {
    try {
      const res = await fetch(EXPO_PUSH_URL, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          ...(this.accessToken ? { Authorization: `Bearer ${this.accessToken}` } : {}),
        },
        body: JSON.stringify(
          tokens.map((to) => ({
            to,
            title: message.title,
            body: message.body,
            data: message.data ?? {},
            sound: 'default',
          })),
        ),
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) {
        this.logger.warn(`Expo push rejected the batch: HTTP ${res.status}`);
        return;
      }
      const { data } = (await res.json()) as { data?: ExpoTicket[] };
      const dead = tokens.filter((_, i) => data?.[i]?.details?.error === 'DeviceNotRegistered');
      if (dead.length) await this.prisma.pushToken.deleteMany({ where: { token: { in: dead } } });
    } catch (err) {
      this.logger.warn(`Expo push failed: ${String(err)}`);
    }
  }
}
