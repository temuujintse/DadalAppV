import { INestApplication } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import type { App } from 'supertest/types';
import { seedReferenceData } from '../prisma/seed-data';
import { PrismaService } from '../src/database/prisma.service';
import { API, auth, createTestApp, registerUser, resetDatabase, TestUser } from './helpers';

const DAILY = [0, 1, 2, 3, 4, 5, 6];

interface QuestView {
  id: string;
  key: string;
  status: string;
  progress: number;
  target: number;
  scope: string;
  claimedBy: { userId: string } | null;
}

describe('Quests & rewards (e2e)', () => {
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

  async function family() {
    const owner = await registerUser(app, { displayName: 'Ээж' });
    const parent = await registerUser(app, { displayName: 'Аав' });
    const child = await registerUser(app, { displayName: 'Хүү' });
    await http()
      .post(`${API}/families`)
      .set(auth(owner))
      .send({ name: 'Шагналын гэр бүл' })
      .expect(201);
    for (const [u, role] of [
      [parent, 'PARENT'],
      [child, 'CHILD'],
    ] as const) {
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
    }
    return { owner, parent, child };
  }

  async function habit(user: TestUser, body: Record<string, unknown> = {}) {
    const res = await http()
      .post(`${API}/habits`)
      .set(auth(user))
      .send({
        title: `Дадал ${randomUUID().slice(0, 4)}`,
        type: 'PERSONAL',
        scheduleDays: DAILY,
        ...body,
      })
      .expect(201);
    return res.body.data.id as string;
  }

  const complete = (user: TestUser, habitId: string) =>
    http()
      .post(`${API}/habits/${habitId}/completions`)
      .set(auth(user))
      .send({ idempotencyKey: randomUUID() });

  async function quests(user: TestUser): Promise<Record<string, QuestView>> {
    const res = await http().get(`${API}/quests`).set(auth(user)).expect(200);
    return Object.fromEntries(res.body.data.map((q: QuestView) => [q.key, q]));
  }

  describe('quests', () => {
    let fam: { owner: TestUser; parent: TestUser; child: TestUser };

    beforeAll(async () => {
      fam = await family();
    });

    it('lists user and family quests for the current period', async () => {
      const q = await quests(fam.child);
      expect(Object.keys(q).sort()).toEqual([
        'daily_all_done',
        'daily_pet_care',
        'daily_two_habits',
        'family_daily_five',
        'family_weekly_thirty',
      ]);
      expect(q.daily_two_habits).toMatchObject({ progress: 0, target: 2, status: 'IN_PROGRESS' });

      const solo = await registerUser(app);
      const soloQuests = await quests(solo);
      expect(Object.values(soloQuests).every((x) => x.scope === 'USER')).toBe(true);
    });

    it('tracks progress from completions and reports newly completed quests', async () => {
      const h1 = await habit(fam.child);
      const h2 = await habit(fam.child);
      const first = await complete(fam.child, h1).expect(201);
      expect(first.body.data.questsCompleted).toEqual([]);

      const second = await complete(fam.child, h2).expect(201);
      const keys = second.body.data.questsCompleted.map((q: { title: string }) => q.title);
      expect(keys).toEqual(expect.arrayContaining(['Өдрийн хоёр алхам', 'Бүгдийг нь!']));

      const q = await quests(fam.child);
      expect(q.daily_two_habits).toMatchObject({ progress: 2, status: 'COMPLETED' });
      expect(q.daily_all_done).toMatchObject({ progress: 1, status: 'COMPLETED' });
      expect(q.family_daily_five).toMatchObject({ progress: 2, status: 'IN_PROGRESS' });
    });

    it('rejects claiming an unfinished quest', async () => {
      const q = await quests(fam.child);
      const res = await http()
        .post(`${API}/quests/${q.daily_pet_care.id}/claim`)
        .set(auth(fam.child))
        .expect(409);
      expect(res.body.error.code).toBe('QUEST_NOT_COMPLETED');
    });

    it('goes back to in-progress after an undo, until claimed', async () => {
      const done = await prisma.habitCompletion.findFirstOrThrow({
        where: { completedById: fam.child.id },
        orderBy: { createdAt: 'desc' },
      });
      await http().delete(`${API}/completions/${done.id}`).set(auth(fam.child)).expect(200);
      let q = await quests(fam.child);
      expect(q.daily_two_habits).toMatchObject({ progress: 1, status: 'IN_PROGRESS' });

      await complete(fam.child, done.habitId).expect(201);
      q = await quests(fam.child);
      expect(q.daily_two_habits.status).toBe('COMPLETED');
    });

    it('pays the quest reward exactly once, even with concurrent claims', async () => {
      const q = await quests(fam.child);
      const before = await prisma.userGamification.findUniqueOrThrow({
        where: { userId: fam.child.id },
      });
      const results = await Promise.all([
        http().post(`${API}/quests/${q.daily_two_habits.id}/claim`).set(auth(fam.child)),
        http().post(`${API}/quests/${q.daily_two_habits.id}/claim`).set(auth(fam.child)),
      ]);
      expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
      const ok = results.find((r) => r.status === 200)!;
      expect(ok.body.data).toMatchObject({
        rewards: { personalXP: 20, familyXP: 0 },
        quest: { status: 'CLAIMED', claimedBy: { userId: fam.child.id } },
      });
      const after = await prisma.userGamification.findUniqueOrThrow({
        where: { userId: fam.child.id },
      });
      expect(after.lifetimeXP - before.lifetimeXP).toBe(20);
      expect(
        await prisma.xPTransaction.count({ where: { userId: fam.child.id, sourceType: 'QUEST' } }),
      ).toBe(1);

      // An undo after claiming never takes the quest reward back.
      const done = await prisma.habitCompletion.findFirstOrThrow({
        where: { completedById: fam.child.id },
        orderBy: { createdAt: 'desc' },
      });
      await http().delete(`${API}/completions/${done.id}`).set(auth(fam.child)).expect(200);
      expect((await quests(fam.child)).daily_two_habits.status).toBe('CLAIMED');
    });

    it('counts pet care for the care quest', async () => {
      await http()
        .post(`${API}/pet/me/care`)
        .set(auth(fam.child))
        .send({ type: 'PET', idempotencyKey: randomUUID() })
        .expect(200);
      const second = await http()
        .post(`${API}/pet/me/care`)
        .set(auth(fam.child))
        .send({ type: 'FEED', idempotencyKey: randomUUID() })
        .expect(200);
      expect(second.body.data.questsCompleted.map((q: { title: string }) => q.title)).toEqual([
        'Найзаа арчил',
      ]);
    });

    it('lets the family finish a family quest together and pays family XP once', async () => {
      // child already has 1 completion today after the undo above; add 4 more across members.
      await complete(fam.owner, await habit(fam.owner)).expect(201);
      await complete(fam.parent, await habit(fam.parent)).expect(201);
      await complete(fam.parent, await habit(fam.parent)).expect(201);
      const last = await complete(fam.owner, await habit(fam.owner)).expect(201);
      expect(last.body.data.questsCompleted.map((q: { title: string }) => q.title)).toContain(
        'Гэр бүлийн 5',
      );

      const q = await quests(fam.parent);
      expect(q.family_daily_five).toMatchObject({ progress: 5, status: 'COMPLETED' });

      const famBefore = await http()
        .get(`${API}/gamification/family`)
        .set(auth(fam.child))
        .expect(200);
      const claim = await http()
        .post(`${API}/quests/${q.family_daily_five.id}/claim`)
        .set(auth(fam.child))
        .expect(200);
      expect(claim.body.data.rewards).toMatchObject({ personalXP: 0, familyXP: 50 });
      const famAfter = await http()
        .get(`${API}/gamification/family`)
        .set(auth(fam.child))
        .expect(200);
      expect(famAfter.body.data.lifetimeXP - famBefore.body.data.lifetimeXP).toBe(50);
      expect(famAfter.body.data.questsCompleted).toBe(1);

      // Everyone sees it claimed; nobody can claim it again.
      const forOwner = await quests(fam.owner);
      expect(forOwner.family_daily_five).toMatchObject({
        status: 'CLAIMED',
        claimedBy: { userId: fam.child.id },
      });
      await http()
        .post(`${API}/quests/${q.family_daily_five.id}/claim`)
        .set(auth(fam.owner))
        .expect(409);

      // "Family teamwork" achievement for every member, not only the claimer.
      const teamwork = await prisma.achievement.findUniqueOrThrow({
        where: { key: 'family_teamwork' },
      });
      for (const u of [fam.owner, fam.parent, fam.child]) {
        expect(
          await prisma.userAchievement.count({
            where: { userId: u.id, achievementId: teamwork.id },
          }),
        ).toBe(1);
      }
    });

    it('hides family quests from outsiders', async () => {
      const outsider = await registerUser(app);
      const q = await quests(fam.owner);
      await http().get(`${API}/quests/${q.family_daily_five.id}`).set(auth(outsider)).expect(404);
      await http()
        .post(`${API}/quests/${q.family_daily_five.id}/claim`)
        .set(auth(outsider))
        .expect(404);
    });
  });

  describe('rewards', () => {
    let fam: { owner: TestUser; parent: TestUser; child: TestUser };
    let movieId: string;

    beforeAll(async () => {
      fam = await family();
      // Give the child spendable XP the honest way: two HARD completions (+ first-step achievement).
      await complete(fam.child, await habit(fam.child, { difficulty: 'HARD' })).expect(201);
      await complete(fam.child, await habit(fam.child, { difficulty: 'HARD' })).expect(201);
    });

    const redeem = (u: TestUser, id: string, key: string = randomUUID()) =>
      http().post(`${API}/rewards/${id}/redeem`).set(auth(u)).send({ idempotencyKey: key });

    it('lets only OWNER/PARENT manage the catalog', async () => {
      await http()
        .post(`${API}/rewards`)
        .set(auth(fam.child))
        .send({ title: 'X', xpCost: 50 })
        .expect(403);
      await http()
        .post(`${API}/rewards`)
        .set(auth(fam.owner))
        .send({ title: 'X', xpCost: 5 })
        .expect(400);
      const res = await http()
        .post(`${API}/rewards`)
        .set(auth(fam.parent))
        .send({ title: 'Кино сонгох эрх', icon: 'film', xpCost: 60 })
        .expect(201);
      movieId = res.body.data.find((r: { title: string }) => r.title === 'Кино сонгох эрх').id;
      await http()
        .post(`${API}/rewards`)
        .set(auth(fam.owner))
        .send({ title: 'Аялал', xpCost: 5000 })
        .expect(201);

      const list = await http().get(`${API}/rewards`).set(auth(fam.child)).expect(200);
      // child has 30 + 30 + 25 = 85 XP
      const byTitle = Object.fromEntries(
        list.body.data.map((r: { title: string }) => [r.title, r]),
      );
      expect(byTitle['Кино сонгох эрх']).toMatchObject({ availableXP: 85, canRedeem: true });
      expect(byTitle['Аялал'].canRedeem).toBe(false);
    });

    it('requests a reward without spending XP and blocks over-committing', async () => {
      const key = randomUUID();
      const req = await redeem(fam.child, movieId, key).expect(201);
      expect(req.body.data).toMatchObject({
        status: 'PENDING',
        xpCost: 60,
        canCancel: true,
        canDecide: false,
      });
      const replay = await redeem(fam.child, movieId, key).expect(201);
      expect(replay.body.data.id).toBe(req.body.data.id);

      const wallet = await prisma.userGamification.findUniqueOrThrow({
        where: { userId: fam.child.id },
      });
      expect(wallet.balanceXP).toBe(85); // nothing spent yet

      // 85 - 60 pending = 25 left → a second 60 XP request is refused.
      const second = await redeem(fam.child, movieId).expect(409);
      expect(second.body.error.code).toBe('INSUFFICIENT_XP');
    });

    it('shows pending requests to managers only', async () => {
      await http().get(`${API}/redemptions?scope=family`).set(auth(fam.child)).expect(403);
      const res = await http()
        .get(`${API}/redemptions?scope=family&status=PENDING`)
        .set(auth(fam.parent))
        .expect(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0]).toMatchObject({
        canDecide: true,
        requester: { userId: fam.child.id },
      });
    });

    it('approves once, spends XP once and never lowers the level', async () => {
      const [pending] = (await http().get(`${API}/redemptions`).set(auth(fam.child)).expect(200))
        .body.data;
      await http()
        .post(`${API}/redemptions/${pending.id}/approve`)
        .set(auth(fam.child))
        .send({})
        .expect(403);

      const before = await prisma.userGamification.findUniqueOrThrow({
        where: { userId: fam.child.id },
      });
      const results = await Promise.all([
        http()
          .post(`${API}/redemptions/${pending.id}/approve`)
          .set(auth(fam.parent))
          .send({ note: 'Баяр хүргэе!' }),
        http().post(`${API}/redemptions/${pending.id}/approve`).set(auth(fam.owner)).send({}),
      ]);
      expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
      const ok = results.find((r) => r.status === 200)!;
      expect(ok.body.data.redemption.status).toBe('APPROVED');
      expect(ok.body.data.requesterWallet).toMatchObject({ balanceXP: 25 });

      const after = await prisma.userGamification.findUniqueOrThrow({
        where: { userId: fam.child.id },
      });
      expect(after.balanceXP).toBe(before.balanceXP - 60);
      expect(after.lifetimeXP).toBe(before.lifetimeXP);
      expect(after.level).toBe(before.level);
      const spend = await prisma.xPTransaction.findMany({
        where: { userId: fam.child.id, kind: 'SPEND' },
      });
      expect(spend.map((s) => s.amount)).toEqual([-60]);

      // Spent XP cannot be clawed back by undoing a completion.
      const done = await prisma.habitCompletion.findFirstOrThrow({
        where: { completedById: fam.child.id },
        orderBy: { createdAt: 'desc' },
      });
      const undo = await http()
        .delete(`${API}/completions/${done.id}`)
        .set(auth(fam.child))
        .expect(409);
      expect(undo.body.error.code).toBe('XP_ALREADY_SPENT');

      await http()
        .post(`${API}/redemptions/${pending.id}/reject`)
        .set(auth(fam.parent))
        .send({})
        .expect(409);
      const handed = await http()
        .post(`${API}/redemptions/${pending.id}/complete`)
        .set(auth(fam.owner))
        .expect(200);
      expect(handed.body.data.redemption).toMatchObject({ status: 'REDEEMED', canComplete: false });
    });

    it('rejects without spending, and lets the requester cancel', async () => {
      const cheap = await http()
        .post(`${API}/rewards`)
        .set(auth(fam.owner))
        .send({ title: 'Зайрмаг', icon: 'ice-cream', xpCost: 10 })
        .expect(201);
      const iceId = cheap.body.data.find((r: { title: string }) => r.title === 'Зайрмаг').id;

      const r1 = await redeem(fam.child, iceId).expect(201);
      const rejected = await http()
        .post(`${API}/redemptions/${r1.body.data.id}/reject`)
        .set(auth(fam.parent))
        .send({ note: 'Маргааш' })
        .expect(200);
      expect(rejected.body.data.redemption).toMatchObject({
        status: 'REJECTED',
        decisionNote: 'Маргааш',
      });

      const r2 = await redeem(fam.child, iceId).expect(201);
      await http()
        .post(`${API}/redemptions/${r2.body.data.id}/cancel`)
        .set(auth(fam.parent))
        .expect(404);
      const cancelled = await http()
        .post(`${API}/redemptions/${r2.body.data.id}/cancel`)
        .set(auth(fam.child))
        .expect(200);
      expect(cancelled.body.data.redemption.status).toBe('CANCELLED');

      const wallet = await prisma.userGamification.findUniqueOrThrow({
        where: { userId: fam.child.id },
      });
      expect(wallet.balanceXP).toBe(25);
    });

    it('stops a parent from approving their own request when another manager exists', async () => {
      const r = await redeem(fam.parent, movieId);
      // parent has no XP yet → insufficient
      expect(r.status).toBe(409);
      await prisma.userGamification.update({
        where: { userId: fam.parent.id },
        data: { balanceXP: 100, lifetimeXP: 100 },
      });
      const ok = await redeem(fam.parent, movieId).expect(201);
      expect(ok.body.data.canDecide).toBe(false); // UI never offers it
      const self = await http()
        .post(`${API}/redemptions/${ok.body.data.id}/approve`)
        .set(auth(fam.parent))
        .send({})
        .expect(403);
      expect(self.body.error.code).toBe('CANNOT_DECIDE_OWN');
      await http()
        .post(`${API}/redemptions/${ok.body.data.id}/approve`)
        .set(auth(fam.owner))
        .send({})
        .expect(200);
    });

    it('cancels pending requests when a reward is deleted, and isolates families', async () => {
      const r = await http()
        .post(`${API}/rewards`)
        .set(auth(fam.owner))
        .send({ title: 'Түр', xpCost: 10 })
        .expect(201);
      const tmpId = r.body.data.find((x: { title: string }) => x.title === 'Түр').id;
      const req = await redeem(fam.child, tmpId).expect(201);
      await http().delete(`${API}/rewards/${tmpId}`).set(auth(fam.owner)).expect(200);
      const row = await prisma.rewardRedemption.findUniqueOrThrow({
        where: { id: req.body.data.id },
      });
      expect(row.status).toBe('CANCELLED');

      const outsider = await registerUser(app);
      await http().post(`${API}/families`).set(auth(outsider)).send({ name: 'Өөр' }).expect(201);
      await redeem(outsider, movieId).expect(404);
      await http()
        .post(`${API}/redemptions/${req.body.data.id}/approve`)
        .set(auth(outsider))
        .send({})
        .expect(404);
      const list = await http().get(`${API}/rewards`).set(auth(outsider)).expect(200);
      expect(list.body.data).toEqual([]);
    });

    it('leaving the family cancels own pending requests', async () => {
      const r = await http()
        .post(`${API}/rewards`)
        .set(auth(fam.owner))
        .send({ title: 'Ном', xpCost: 10 })
        .expect(201);
      const bookId = r.body.data.find((x: { title: string }) => x.title === 'Ном').id;
      const req = await redeem(fam.child, bookId).expect(201);
      const members = (
        await http().get(`${API}/families/current/members`).set(auth(fam.child)).expect(200)
      ).body.data;
      const me = members.find((m: { isMe: boolean }) => m.isMe);
      await http()
        .delete(`${API}/families/current/members/${me.id}`)
        .set(auth(fam.child))
        .expect(200);
      const row = await prisma.rewardRedemption.findUniqueOrThrow({
        where: { id: req.body.data.id },
      });
      expect(row.status).toBe('CANCELLED');
    });
  });
});
