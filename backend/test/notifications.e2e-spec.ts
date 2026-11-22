import { INestApplication } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import type { App } from 'supertest/types';
import { seedReferenceData } from '../prisma/seed-data';
import { PrismaService } from '../src/database/prisma.service';
import { MailService } from '../src/mail/mail.service';
import { NotificationsService } from '../src/notifications/notifications.service';
import { PushService } from '../src/notifications/push.service';
import { API, auth, createTestApp, registerUser, resetDatabase, TestUser } from './helpers';

const DAILY = [0, 1, 2, 3, 4, 5, 6];
const token = () => `ExponentPushToken[${randomUUID().replace(/-/g, '').slice(0, 22)}]`;

describe('Password reset & notifications (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let mail: MailService;
  let push: PushService;
  let notifications: NotificationsService;
  const http = () => request(app.getHttpServer());

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
    await resetDatabase(prisma);
    await seedReferenceData(prisma);
    mail = app.get(MailService);
    push = app.get(PushService);
    notifications = app.get(NotificationsService);
  });

  afterAll(async () => {
    await app.close();
  });

  // ───────────── Password reset ─────────────

  describe('password reset', () => {
    const codeFor = (email: string) => {
      const msg = [...mail.outbox].reverse().find((m) => m.to === email);
      return msg?.text.match(/\b(\d{6})\b/)?.[1];
    };
    const forgot = (email: string) =>
      http().post(`${API}/auth/password/forgot`).send({ email }).expect(200);
    const reset = (email: string, code: string, password = 'newpass123') =>
      http().post(`${API}/auth/password/reset`).send({ email, code, password });

    it('answers the same for unknown e-mails and sends nothing', async () => {
      const before = mail.outbox.length;
      const res = await forgot('nobody-here@example.com');
      expect(res.body).toEqual({ success: true, data: null });
      expect(mail.outbox.length).toBe(before);
    });

    it('resets with the e-mailed code, signs out every device, and the code works once', async () => {
      const u = await registerUser(app);
      await forgot(u.email.toUpperCase()); // e-mail is normalised
      const code = codeFor(u.email)!;
      expect(code).toMatch(/^\d{6}$/);
      const stored = await prisma.passwordReset.findFirstOrThrow({ where: { userId: u.id } });
      expect(stored.codeHash).not.toContain(code);

      await reset(u.email, code).expect(200);
      await http().get(`${API}/auth/me`).set(auth(u)).expect(401); // old session revoked
      await http()
        .post(`${API}/auth/login`)
        .send({ email: u.email, password: 'secret123' })
        .expect(401);
      await http()
        .post(`${API}/auth/login`)
        .send({ email: u.email, password: 'newpass123' })
        .expect(200);

      const again = await reset(u.email, code, 'another123').expect(400);
      expect(again.body.error.code).toBe('RESET_CODE_INVALID');
    });

    it('locks the code after 5 wrong attempts and a new request replaces the old code', async () => {
      const u = await registerUser(app);
      await forgot(u.email);
      const code = codeFor(u.email)!;
      const wrong = code === '000000' ? '111111' : '000000';
      for (let i = 0; i < 5; i++) await reset(u.email, wrong).expect(400);
      await reset(u.email, code).expect(400); // locked even with the right code

      await forgot(u.email);
      const fresh = codeFor(u.email)!;
      if (fresh !== code) await reset(u.email, code).expect(400); // old code no longer valid
      await reset(u.email, fresh).expect(200);
    });

    it('validates the new password and the code format', async () => {
      const u = await registerUser(app);
      await forgot(u.email);
      const code = codeFor(u.email)!;
      await reset(u.email, code, 'short').expect(400);
      await reset(u.email, code, 'onlyletters').expect(400);
      await http()
        .post(`${API}/auth/password/reset`)
        .send({ email: u.email, code: '12ab', password: 'newpass123' })
        .expect(400);
    });
  });

  // ───────────── Notifications ─────────────

  describe('notifications', () => {
    let owner: TestUser;
    let parent: TestUser;
    let child: TestUser;

    async function join(u: TestUser, role: string) {
      const inv = await http()
        .post(`${API}/families/current/invites`)
        .set(auth(owner))
        .send({ role })
        .expect(201);
      await http()
        .post(`${API}/families/join`)
        .set(auth(u))
        .send({ code: inv.body.data.code })
        .expect(200);
      await notifications.flush();
    }
    interface InboxBody {
      data: { id: string; type: string; body: string; data: unknown; readAt: string | null }[];
      meta: { total: number };
    }
    const inbox = async (u: TestUser): Promise<InboxBody> =>
      (await http().get(`${API}/notifications`).set(auth(u)).expect(200)).body as InboxBody;

    beforeAll(async () => {
      owner = await registerUser(app, { displayName: 'Ээж' });
      parent = await registerUser(app, { displayName: 'Аав' });
      child = await registerUser(app, { displayName: 'Охин' });
      await http().post(`${API}/families`).set(auth(owner)).send({ name: 'Мэдэгдэл' }).expect(201);
    });

    it('registers push tokens, rejects malformed ones and moves a device to the last user', async () => {
      const t = token();
      await http()
        .put(`${API}/notifications/push-token`)
        .set(auth(owner))
        .send({ token: 'not-a-token', platform: 'IOS' })
        .expect(400);
      await http()
        .put(`${API}/notifications/push-token`)
        .set(auth(parent))
        .send({ token: t, platform: 'IOS' })
        .expect(200);
      await http()
        .put(`${API}/notifications/push-token`)
        .set(auth(owner))
        .send({ token: t, platform: 'IOS' })
        .expect(200);
      const row = await prisma.pushToken.findUniqueOrThrow({ where: { token: t } });
      expect(row.userId).toBe(owner.id);
      // Removing someone else's token does nothing.
      await http()
        .delete(`${API}/notifications/push-token`)
        .set(auth(parent))
        .send({ token: t })
        .expect(200);
      expect(await prisma.pushToken.count({ where: { token: t } })).toBe(1);
    });

    it('tells existing members when someone joins (inbox + push)', async () => {
      push.outbox.length = 0;
      await join(parent, 'PARENT');
      await join(child, 'CHILD');
      const body = await inbox(owner);
      expect(body.data[0]).toMatchObject({
        type: 'FAMILY_ACTIVITY',
        body: expect.stringContaining('Охин') as string,
        data: { route: '/family' },
        readAt: null,
      });
      expect(body.meta.total).toBe(2);
      expect(push.outbox.some((p) => p.message.body.includes('Аав'))).toBe(true);
      expect((await inbox(child)).meta.total).toBe(0); // the joiner is not notified
    });

    it('announces a SHARED family habit to everyone except the one who did it', async () => {
      const h = await http()
        .post(`${API}/habits`)
        .set(auth(owner))
        .send({
          title: 'Хог гаргах',
          type: 'FAMILY',
          completionMode: 'SHARED',
          scheduleDays: DAILY,
        })
        .expect(201);
      const before = (await inbox(owner)).meta.total;
      await http()
        .post(`${API}/habits/${h.body.data.id}/completions`)
        .set(auth(child))
        .send({ idempotencyKey: randomUUID() })
        .expect(201);
      await notifications.flush();
      const ownerInbox = await inbox(owner);
      expect(ownerInbox.meta.total).toBe(before + 1);
      expect(ownerInbox.data[0].body).toContain('Хог гаргах');
      expect((await inbox(child)).data.some((n: { body: string }) => n.body.includes('Хог'))).toBe(
        false,
      );
    });

    it('routes reward requests to managers and decisions back to the requester', async () => {
      const rewards = await http()
        .post(`${API}/rewards`)
        .set(auth(owner))
        .send({ title: 'Кино', xpCost: 10 })
        .expect(201);
      const rewardId = (rewards.body.data as { id: string; title: string }[]).find(
        (r) => r.title === 'Кино',
      )!.id;
      const req = await http()
        .post(`${API}/rewards/${rewardId}/redeem`)
        .set(auth(child))
        .send({ idempotencyKey: randomUUID() })
        .expect(201);
      await notifications.flush();
      for (const manager of [owner, parent]) {
        expect((await inbox(manager)).data[0]).toMatchObject({ type: 'REWARD_REQUESTED' });
      }

      await http()
        .post(`${API}/redemptions/${req.body.data.id}/approve`)
        .set(auth(parent))
        .expect(200);
      await notifications.flush();
      expect((await inbox(child)).data[0]).toMatchObject({
        type: 'REWARD_APPROVED',
        body: expect.stringContaining('Кино') as string,
      });
    });

    it('counts unread, marks one or all as read, and keeps inboxes private', async () => {
      const unread = await http()
        .get(`${API}/notifications/unread-count`)
        .set(auth(owner))
        .expect(200);
      expect(unread.body.data.unread).toBeGreaterThan(0);
      const first = (await inbox(owner)).data[0];

      await http().post(`${API}/notifications/${first.id}/read`).set(auth(child)).expect(404);
      const read = await http()
        .post(`${API}/notifications/${first.id}/read`)
        .set(auth(owner))
        .expect(200);
      expect(read.body.data.readAt).not.toBeNull();

      await http().post(`${API}/notifications/read-all`).set(auth(owner)).expect(200);
      const after = await http()
        .get(`${API}/notifications/unread-count`)
        .set(auth(owner))
        .expect(200);
      expect(after.body.data.unread).toBe(0);

      const page = await http()
        .get(`${API}/notifications?limit=1&page=2`)
        .set(auth(owner))
        .expect(200);
      expect(page.body.data).toHaveLength(1);
      expect(page.body.meta).toMatchObject({ page: 2, limit: 1 });
    });

    it('stores, updates and clears a habit reminder time', async () => {
      const created = await http()
        .post(`${API}/habits`)
        .set(auth(child))
        .send({ title: 'Ном', type: 'PERSONAL', scheduleDays: DAILY, reminderTime: '19:30' })
        .expect(201);
      expect(created.body.data.reminderTime).toBe('19:30');
      const id = created.body.data.id as string;
      await http()
        .patch(`${API}/habits/${id}`)
        .set(auth(child))
        .send({ reminderTime: '25:00' })
        .expect(400);
      const cleared = await http()
        .patch(`${API}/habits/${id}`)
        .set(auth(child))
        .send({ reminderTime: null })
        .expect(200);
      expect(cleared.body.data.reminderTime).toBeNull();
    });
  });
});
