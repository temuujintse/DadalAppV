import { INestApplication } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import type { App } from 'supertest/types';
import { addDays, toDbDate, weekdayOf } from '../src/common/utils/local-date';
import { localDateString } from '../src/common/utils/timezone.util';
import { PrismaService } from '../src/database/prisma.service';
import { API, auth, createTestApp, registerUser, resetDatabase, TestUser } from './helpers';

const DAILY = [0, 1, 2, 3, 4, 5, 6];
const TZ = 'Asia/Ulaanbaatar';

describe('Habits & completions (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const http = () => request(app.getHttpServer());
  const today = () => localDateString(TZ);

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
    await resetDatabase(prisma);
  });

  afterAll(async () => {
    await app.close();
  });

  async function createHabit(user: TestUser, body: Record<string, unknown>) {
    return http()
      .post(`${API}/habits`)
      .set(auth(user))
      .send({ scheduleDays: DAILY, ...body });
  }

  async function complete(user: TestUser, habitId: string, key: string = randomUUID(), extra = {}) {
    return http()
      .post(`${API}/habits/${habitId}/completions`)
      .set(auth(user))
      .send({ idempotencyKey: key, ...extra });
  }

  async function setupFamily() {
    const owner = await registerUser(app);
    const child = await registerUser(app);
    const member = await registerUser(app);
    await http()
      .post(`${API}/families`)
      .set(auth(owner))
      .send({ name: 'Дадлын гэр бүл' })
      .expect(201);
    for (const [u, role] of [
      [child, 'CHILD'],
      [member, 'MEMBER'],
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
    return { owner, child, member };
  }

  describe('personal habits', () => {
    let me: TestUser;
    let habitId: string;

    beforeAll(async () => {
      me = await registerUser(app);
      const res = await createHabit(me, {
        title: '  Ном унших ',
        type: 'PERSONAL',
        difficulty: 'MEDIUM',
      });
      expect(res.status).toBe(201);
      habitId = res.body.data.id;
      expect(res.body.data).toMatchObject({
        title: 'Ном унших',
        type: 'PERSONAL',
        completionMode: null,
        xpReward: 20,
        canManage: true,
        canComplete: true,
        startDate: today(),
        assignees: [{ userId: me.id }],
        today: { date: today(), isScheduled: true, isCompleted: false },
        streak: { current: 0, longest: 0 },
      });
    });

    it('rejects completion mode or assignees on personal habits', async () => {
      const res = await createHabit(me, { title: 'X', type: 'PERSONAL', completionMode: 'SHARED' });
      expect(res.status).toBe(400);
    });

    it('rejects a start date in the past and an end before the start', async () => {
      const past = await createHabit(me, {
        title: 'X',
        type: 'PERSONAL',
        startDate: addDays(today(), -1),
      });
      expect(past.status).toBe(422);
      expect(past.body.error.code).toBe('DATE_OUT_OF_RANGE');
      const badEnd = await createHabit(me, {
        title: 'X',
        type: 'PERSONAL',
        startDate: addDays(today(), 3),
        endDate: addDays(today(), 2),
      });
      expect(badEnd.status).toBe(422);
    });

    it('completes once per day, replays idempotently and reports the streak', async () => {
      const key = randomUUID();
      const first = await complete(me, habitId, key);
      expect(first.status).toBe(201);
      expect(first.body.data).toMatchObject({
        replayed: false,
        streak: { current: 1, longest: 1 },
        completion: { localDate: today(), completedBy: { userId: me.id } },
      });

      const replay = await complete(me, habitId, key);
      expect(replay.status).toBe(200);
      expect(replay.body.data.replayed).toBe(true);
      expect(replay.body.data.completion.id).toBe(first.body.data.completion.id);

      const again = await complete(me, habitId);
      expect(again.status).toBe(409);
      expect(again.body.error.code).toBe('ALREADY_COMPLETED');

      expect(await prisma.habitCompletion.count({ where: { habitId } })).toBe(1);

      const list = await http().get(`${API}/habits`).set(auth(me)).expect(200);
      const h = list.body.data.find((x: { id: string }) => x.id === habitId);
      expect(h.today).toMatchObject({ isCompleted: true, canUndo: true });
      expect(h.streak.current).toBe(1);
    });

    it('rejects reusing an idempotency key for another habit and non-today dates', async () => {
      const other = await createHabit(me, { title: 'Ус уух', type: 'PERSONAL' });
      const used = await prisma.habitCompletion.findFirstOrThrow({ where: { habitId } });
      const reused = await complete(me, other.body.data.id, used.idempotencyKey);
      expect(reused.status).toBe(409);
      expect(reused.body.error.code).toBe('IDEMPOTENCY_KEY_REUSED');

      const yesterday = await complete(me, other.body.data.id, randomUUID(), {
        localDate: addDays(today(), -1),
      });
      expect(yesterday.status).toBe(422);
      expect(yesterday.body.error.code).toBe('DATE_OUT_OF_RANGE');
    });

    it('lets exactly one of two concurrent completions through', async () => {
      const h = await createHabit(me, { title: 'Зэрэг', type: 'PERSONAL' });
      const results = await Promise.all([
        complete(me, h.body.data.id),
        complete(me, h.body.data.id),
      ]);
      expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
      expect(await prisma.habitCompletion.count({ where: { habitId: h.body.data.id } })).toBe(1);
    });

    it('undoes today’s completion, recalculates the streak and allows completing again', async () => {
      const completion = await prisma.habitCompletion.findFirstOrThrow({ where: { habitId } });
      const stranger = await registerUser(app);
      await http().delete(`${API}/completions/${completion.id}`).set(auth(stranger)).expect(404);

      const undo = await http()
        .delete(`${API}/completions/${completion.id}`)
        .set(auth(me))
        .expect(200);
      expect(undo.body.data.streak).toEqual({ current: 0, longest: 0 });
      expect((await complete(me, habitId)).status).toBe(201);
    });

    it('refuses completion on an unscheduled day', async () => {
      const notToday = DAILY.filter((d) => d !== weekdayOf(today()));
      const h = await createHabit(me, {
        title: 'Амрах өдөр',
        type: 'PERSONAL',
        scheduleDays: notToday,
      });
      expect(h.body.data.today.isScheduled).toBe(false);
      const res = await complete(me, h.body.data.id);
      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe('NOT_SCHEDULED_TODAY');
    });

    it('rebuilds the streak from history and resets after a missed scheduled day', async () => {
      const h = await createHabit(me, { title: 'Түүхтэй', type: 'PERSONAL' });
      const id = h.body.data.id as string;
      await prisma.habit.update({
        where: { id },
        data: { startDate: toDbDate(addDays(today(), -6)) },
      });
      // Completed 4 and 3 days ago, missed 2 and 1 days ago.
      for (const offset of [-4, -3]) {
        const d = addDays(today(), offset);
        await prisma.habitCompletion.create({
          data: {
            habitId: id,
            userId: me.id,
            completedById: me.id,
            localDate: toDbDate(d),
            completionKey: `${id}:${me.id}:${d}`,
            idempotencyKey: randomUUID(),
          },
        });
      }
      const res = await complete(me, id);
      expect(res.body.data.streak).toEqual({ current: 1, longest: 2 });
    });

    it('keeps personal habits private', async () => {
      const stranger = await registerUser(app);
      await http().get(`${API}/habits/${habitId}`).set(auth(stranger)).expect(404);
      expect((await complete(stranger, habitId)).status).toBe(404);
      const list = await http().get(`${API}/habits`).set(auth(stranger)).expect(200);
      expect(list.body.data).toEqual([]);
    });

    it('returns a month calendar', async () => {
      const res = await http().get(`${API}/habits/${habitId}/calendar`).set(auth(me)).expect(200);
      const cal = res.body.data;
      expect(cal.month).toBe(today().slice(0, 7));
      const todayCell = cal.days.find((d: { date: string }) => d.date === today());
      expect(todayCell).toMatchObject({ isScheduled: true, isCompleted: true, isFuture: false });
      expect(cal.completedCount).toBe(1);
      await http().get(`${API}/habits/${habitId}/calendar?month=2026-13`).set(auth(me)).expect(400);
    });
  });

  describe('family habits', () => {
    let owner: TestUser;
    let child: TestUser;
    let member: TestUser;

    beforeAll(async () => {
      ({ owner, child, member } = await setupFamily());
    });

    it('only OWNER/PARENT create family habits, and FAMILY requires a completion mode', async () => {
      const byMember = await createHabit(member, {
        title: 'X',
        type: 'FAMILY',
        completionMode: 'SHARED',
      });
      expect(byMember.status).toBe(403);
      const noMode = await createHabit(owner, { title: 'X', type: 'FAMILY' });
      expect(noMode.status).toBe(400);
    });

    it('rejects assignees outside the family', async () => {
      const outsider = await registerUser(app);
      const res = await createHabit(owner, {
        title: 'X',
        type: 'FAMILY',
        completionMode: 'PER_MEMBER',
        assignedUserIds: [owner.id, outsider.id],
      });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_ASSIGNEES');
    });

    it('PER_MEMBER: each assigned member completes separately; others cannot', async () => {
      const res = await createHabit(owner, {
        title: 'Шүдээ угаах',
        type: 'FAMILY',
        completionMode: 'PER_MEMBER',
        assignedUserIds: [owner.id, child.id],
      });
      expect(res.status).toBe(201);
      const id = res.body.data.id as string;

      expect((await complete(child, id)).status).toBe(201);
      expect((await complete(owner, id)).status).toBe(201);
      const notAssigned = await complete(member, id);
      expect(notAssigned.status).toBe(403);
      expect(notAssigned.body.error.code).toBe('NOT_ASSIGNED');

      const detail = await http().get(`${API}/habits/${id}`).set(auth(member)).expect(200);
      expect(detail.body.data.canComplete).toBe(false);
      expect(
        detail.body.data.todayByMember.map((m: { userId: string; completed: boolean }) => [
          m.userId,
          m.completed,
        ]),
      ).toEqual(
        expect.arrayContaining([
          [owner.id, true],
          [child.id, true],
        ]),
      );
      expect(await prisma.habitCompletion.count({ where: { habitId: id } })).toBe(2);
    });

    it('SHARED: one completion per day for the whole family', async () => {
      const res = await createHabit(owner, {
        title: 'Хамтдаа гэрээ цэвэрлэх',
        type: 'FAMILY',
        completionMode: 'SHARED',
        difficulty: 'HARD',
      });
      const id = res.body.data.id as string;
      expect(res.body.data.assignees).toHaveLength(3); // defaults to every member

      const byChild = await complete(child, id);
      expect(byChild.status).toBe(201);
      expect(byChild.body.data.streak.current).toBe(1);

      const byOwner = await complete(owner, id);
      expect(byOwner.status).toBe(409);
      expect(byOwner.body.error.code).toBe('ALREADY_COMPLETED');
      expect(byOwner.body.error.message).toContain('гэр бүлийн өмнөөс');

      const ownerView = await http().get(`${API}/habits/${id}`).set(auth(owner)).expect(200);
      expect(ownerView.body.data.today).toMatchObject({
        isCompleted: true,
        canUndo: false,
        completedBy: { userId: child.id },
      });
      expect(ownerView.body.data.streak.current).toBe(1);

      const stored = await prisma.habitCompletion.findFirstOrThrow({ where: { habitId: id } });
      expect(stored.userId).toBeNull();
      expect(stored.completedById).toBe(child.id);
      expect(await prisma.familyHabitStreak.count({ where: { habitId: id } })).toBe(1);
    });

    it('limits editing to managers and hides archived/deleted habits', async () => {
      const res = await createHabit(owner, {
        title: 'Засварлах',
        type: 'FAMILY',
        completionMode: 'SHARED',
      });
      const id = res.body.data.id as string;

      await http().patch(`${API}/habits/${id}`).set(auth(child)).send({ title: 'Хак' }).expect(403);
      const updated = await http()
        .patch(`${API}/habits/${id}`)
        .set(auth(owner))
        .send({ title: 'Шинэ нэр', scheduleDays: [1, 3, 5], difficulty: 'HARD' })
        .expect(200);
      expect(updated.body.data).toMatchObject({
        title: 'Шинэ нэр',
        scheduleDays: [1, 3, 5],
        xpReward: 30,
      });

      await http()
        .patch(`${API}/habits/${id}`)
        .set(auth(owner))
        .send({ status: 'ARCHIVED' })
        .expect(200);
      const active = await http().get(`${API}/habits?scope=family`).set(auth(child)).expect(200);
      expect(active.body.data.map((h: { id: string }) => h.id)).not.toContain(id);
      const archived = await http()
        .get(`${API}/habits?status=ARCHIVED`)
        .set(auth(child))
        .expect(200);
      expect(archived.body.data.map((h: { id: string }) => h.id)).toContain(id);
      const done = await complete(child, id);
      expect(done.status).toBe(409); // archived habits cannot be completed
      expect(done.body.error.code).toBe('HABIT_NOT_ACTIVE');

      await http().delete(`${API}/habits/${id}`).set(auth(child)).expect(403);
      await http().delete(`${API}/habits/${id}`).set(auth(owner)).expect(200);
      await http().get(`${API}/habits/${id}`).set(auth(owner)).expect(404);
    });

    it('replaces assignments and isolates other families', async () => {
      const res = await createHabit(owner, {
        title: 'Оноолт',
        type: 'FAMILY',
        completionMode: 'PER_MEMBER',
      });
      const id = res.body.data.id as string;
      const reassigned = await http()
        .post(`${API}/habits/${id}/assignments`)
        .set(auth(owner))
        .send({ userIds: [member.id] })
        .expect(200);
      expect(reassigned.body.data.assignees.map((a: { userId: string }) => a.userId)).toEqual([
        member.id,
      ]);
      expect((await complete(child, id)).status).toBe(403);

      const outsider = await registerUser(app);
      await http().post(`${API}/families`).set(auth(outsider)).send({ name: 'Гадны' }).expect(201);
      await http().get(`${API}/habits/${id}`).set(auth(outsider)).expect(404);
      expect((await complete(outsider, id)).status).toBe(404);
      await http()
        .post(`${API}/habits/${id}/assignments`)
        .set(auth(outsider))
        .send({ userIds: [outsider.id] })
        .expect(404);
    });

    it('"today" scope lists only habits the caller can complete today', async () => {
      const res = await http().get(`${API}/habits?scope=today`).set(auth(member)).expect(200);
      for (const h of res.body.data) {
        expect(h.canComplete).toBe(true);
        expect(h.today.isScheduled).toBe(true);
      }
    });
  });
});
