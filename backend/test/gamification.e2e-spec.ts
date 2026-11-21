import { INestApplication } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import type { App } from 'supertest/types';
import { seedReferenceData } from '../prisma/seed-data';
import { PrismaService } from '../src/database/prisma.service';
import { API, auth, createTestApp, registerUser, resetDatabase, TestUser } from './helpers';

const DAILY = [0, 1, 2, 3, 4, 5, 6];

describe('Gamification (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const http = () => request(app.getHttpServer());

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
    await resetDatabase(prisma);
    await seedReferenceData(prisma);
  });

  afterAll(async () => {
    await app.close();
  });

  async function habit(user: TestUser, body: Record<string, unknown>): Promise<string> {
    const res = await http()
      .post(`${API}/habits`)
      .set(auth(user))
      .send({ scheduleDays: DAILY, ...body })
      .expect(201);
    return res.body.data.id as string;
  }

  function complete(user: TestUser, habitId: string, key: string = randomUUID()) {
    return http()
      .post(`${API}/habits/${habitId}/completions`)
      .set(auth(user))
      .send({ idempotencyKey: key });
  }

  async function ledger(where: Record<string, unknown>) {
    return prisma.xPTransaction.findMany({ where, orderBy: { createdAt: 'asc' } });
  }

  describe('personal XP', () => {
    let me: TestUser;
    let easy: string;
    let key: string;

    beforeAll(async () => {
      me = await registerUser(app);
      easy = await habit(me, { title: 'Ус уух', type: 'PERSONAL', difficulty: 'EASY' });
    });

    it('awards server-side XP and the first-step achievement in the same transaction', async () => {
      key = randomUUID();
      const res = await complete(me, easy, key).expect(201);
      expect(res.body.data.rewards).toEqual({ personalXP: 10, familyXP: 0, petXP: 10 });
      expect(res.body.data.family).toBeNull();
      expect(res.body.data.achievementsUnlocked.map((a: { key: string }) => a.key)).toEqual([
        'first_step',
      ]);
      // 10 (habit) + 25 (achievement)
      expect(res.body.data.gamification).toMatchObject({
        level: 1,
        lifetimeXP: 35,
        balanceXP: 35,
        xpIntoLevel: 35,
        xpForNextLevel: 100,
        leveledUp: false,
      });

      const rows = await ledger({ userId: me.id });
      expect(rows.map((r) => [r.kind, r.sourceType, r.amount])).toEqual([
        ['EARN', 'HABIT_COMPLETION', 10],
        ['EARN', 'ACHIEVEMENT', 25],
      ]);
    });

    it('never awards XP twice for a replayed request', async () => {
      const replay = await complete(me, easy, key).expect(200);
      expect(replay.body.data).toMatchObject({
        replayed: true,
        rewards: { personalXP: 10, familyXP: 0 },
        achievementsUnlocked: [],
      });
      expect(await prisma.xPTransaction.count({ where: { userId: me.id } })).toBe(2);
    });

    it('reverses XP on undo but keeps the unlocked achievement', async () => {
      const completion = await prisma.habitCompletion.findFirstOrThrow({
        where: { habitId: easy },
      });
      const undo = await http()
        .delete(`${API}/completions/${completion.id}`)
        .set(auth(me))
        .expect(200);
      expect(undo.body.data.rewards).toEqual({ personalXP: -10, familyXP: 0, petXP: -10 });
      expect(undo.body.data.gamification).toMatchObject({ lifetimeXP: 25, balanceXP: 25 });

      const reversal = await ledger({ userId: me.id, kind: 'REVERSAL' });
      expect(reversal).toHaveLength(1);
      expect(reversal[0]).toMatchObject({ amount: -10, sourceType: 'COMPLETION_REVERSAL' });
      expect(await prisma.userAchievement.count({ where: { userId: me.id } })).toBe(1);

      // Completing again earns again (net one award per day), no second first_step.
      const again = await complete(me, easy).expect(201);
      expect(again.body.data.achievementsUnlocked).toEqual([]);
      expect(again.body.data.gamification.lifetimeXP).toBe(35);
    });

    it('refuses to undo XP that was already spent', async () => {
      const completion = await prisma.habitCompletion.findFirstOrThrow({
        where: { habitId: easy },
      });
      // Simulate a reward redemption having spent the balance (Phase 7 will do this for real).
      await prisma.userGamification.update({ where: { userId: me.id }, data: { balanceXP: 0 } });
      const res = await http()
        .delete(`${API}/completions/${completion.id}`)
        .set(auth(me))
        .expect(409);
      expect(res.body.error.code).toBe('XP_ALREADY_SPENT');
      expect(await prisma.habitCompletion.count({ where: { id: completion.id } })).toBe(1);
      await prisma.userGamification.update({ where: { userId: me.id }, data: { balanceXP: 35 } });
    });

    it('levels up exactly when lifetime XP crosses the threshold', async () => {
      const hard1 = await habit(me, { title: 'Гүйх', type: 'PERSONAL', difficulty: 'HARD' });
      const hard2 = await habit(me, { title: 'Сэлэх', type: 'PERSONAL', difficulty: 'HARD' });
      const r1 = await complete(me, hard1).expect(201); // 35 + 30 = 65
      expect(r1.body.data.gamification).toMatchObject({ lifetimeXP: 65, leveledUp: false });
      const r2 = await complete(me, hard2).expect(201); // 95
      expect(r2.body.data.gamification).toMatchObject({ level: 1, leveledUp: false });

      const hard3 = await habit(me, { title: 'Дасгал', type: 'PERSONAL', difficulty: 'HARD' });
      const r3 = await complete(me, hard3).expect(201); // 125 → level 2
      expect(r3.body.data.gamification).toMatchObject({
        level: 2,
        leveledUp: true,
        xpIntoLevel: 25,
        xpForNextLevel: 150,
      });
    });

    it('reports stats, achievements with progress and a readable ledger', async () => {
      const me1 = await http().get(`${API}/gamification/me`).set(auth(me)).expect(200);
      expect(me1.body.data).toMatchObject({
        level: 2,
        lifetimeXP: 125,
        totalCompletions: 4,
        completionDays: 1,
        bestStreak: 1,
        achievementsUnlocked: 1,
        achievementsTotal: 9,
      });

      const achievements = await http()
        .get(`${API}/gamification/achievements`)
        .set(auth(me))
        .expect(200);
      const byKey = Object.fromEntries(
        achievements.body.data.map((a: { key: string }) => [a.key, a]),
      );
      expect(byKey.first_step.unlockedAt).toBeTruthy();
      expect(byKey.habit_builder).toMatchObject({ progress: 4, threshold: 5, unlockedAt: null });

      const tx = await http()
        .get(`${API}/gamification/me/transactions?limit=3`)
        .set(auth(me))
        .expect(200);
      expect(tx.body.meta).toMatchObject({ limit: 3, total: 7 });
      expect(tx.body.data[0]).toMatchObject({ title: 'Дасгал', amount: 30, kind: 'EARN' });
    });
  });

  describe('family XP & leaderboard', () => {
    let owner: TestUser;
    let child: TestUser;
    let outsider: TestUser;

    beforeAll(async () => {
      owner = await registerUser(app, { displayName: 'Ээж' });
      child = await registerUser(app, { displayName: 'Хүү' });
      outsider = await registerUser(app);
      await http()
        .post(`${API}/families`)
        .set(auth(owner))
        .send({ name: 'XP гэр бүл' })
        .expect(201);
      const inv = await http()
        .post(`${API}/families/current/invites`)
        .set(auth(owner))
        .send({ role: 'CHILD' })
        .expect(201);
      await http()
        .post(`${API}/families/join`)
        .set(auth(child))
        .send({ code: inv.body.data.code })
        .expect(200);
      await http().post(`${API}/families`).set(auth(outsider)).send({ name: 'Өөр' }).expect(201);
    });

    it('PER_MEMBER adds family XP for every member; SHARED only once', async () => {
      const perMember = await habit(owner, {
        title: 'Шүдээ угаах',
        type: 'FAMILY',
        completionMode: 'PER_MEMBER',
        difficulty: 'MEDIUM',
      });
      const a = await complete(owner, perMember).expect(201);
      expect(a.body.data.rewards).toEqual({ personalXP: 20, familyXP: 20, petXP: 20 });
      const b = await complete(child, perMember).expect(201);
      expect(b.body.data.family).toMatchObject({ lifetimeXP: 40, level: 1 });

      const shared = await habit(owner, {
        title: 'Гэрээ цэвэрлэх',
        type: 'FAMILY',
        completionMode: 'SHARED',
        difficulty: 'HARD',
      });
      const c = await complete(child, shared).expect(201);
      expect(c.body.data.rewards).toEqual({ personalXP: 30, familyXP: 30, petXP: 30 });
      await complete(owner, shared).expect(409);

      const fam = await http().get(`${API}/gamification/family`).set(auth(owner)).expect(200);
      expect(fam.body.data).toMatchObject({ lifetimeXP: 70, weekXP: 70, leaderboardEnabled: true });

      // Personal XP only for the member who actually completed the SHARED habit.
      const ownerShared = await ledger({ userId: owner.id, sourceType: 'HABIT_COMPLETION' });
      expect(ownerShared.map((r) => r.amount)).toEqual([20]);
    });

    it('ranks members inside the family only', async () => {
      const res = await http()
        .get(`${API}/gamification/leaderboard?period=week`)
        .set(auth(child))
        .expect(200);
      const lb = res.body.data;
      expect(lb.enabled).toBe(true);
      // child: 20 + 30 + 25 (first_step) = 75, owner: 20 + 25 = 45
      expect(
        lb.entries.map((e: { displayName: string; xp: number; rank: number }) => [
          e.displayName,
          e.xp,
          e.rank,
        ]),
      ).toEqual([
        ['Хүү', 75, 1],
        ['Ээж', 45, 2],
      ]);
      expect(lb.entries.find((e: { isMe: boolean }) => e.isMe).displayName).toBe('Хүү');
      expect(lb.entries.map((e: { userId: string }) => e.userId)).not.toContain(outsider.id);

      await http().get(`${API}/gamification/leaderboard?period=year`).set(auth(child)).expect(400);
    });

    it('lets OWNER/PARENT turn the leaderboard off for the family', async () => {
      await http()
        .patch(`${API}/families/current`)
        .set(auth(child))
        .send({ leaderboardEnabled: false })
        .expect(403);
      const updated = await http()
        .patch(`${API}/families/current`)
        .set(auth(owner))
        .send({ leaderboardEnabled: false })
        .expect(200);
      expect(updated.body.data.leaderboardEnabled).toBe(false);

      const res = await http().get(`${API}/gamification/leaderboard`).set(auth(child)).expect(200);
      expect(res.body.data).toMatchObject({ enabled: false, entries: [] });
    });

    it('keeps the ledger append-only even through the API flows', async () => {
      const count = await prisma.xPTransaction.count();
      expect(count).toBeGreaterThan(0);
      const any = await prisma.xPTransaction.findFirstOrThrow();
      await expect(
        prisma.xPTransaction.update({ where: { id: any.id }, data: { amount: 1 } }),
      ).rejects.toThrow();
    });
  });
});
