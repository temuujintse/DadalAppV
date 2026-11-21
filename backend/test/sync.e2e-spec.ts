import { INestApplication } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import type { App } from 'supertest/types';
import { seedReferenceData } from '../prisma/seed-data';
import { addDays, toDbDate } from '../src/common/utils/local-date';
import { localDateString } from '../src/common/utils/timezone.util';
import { PrismaService } from '../src/database/prisma.service';
import { API, auth, createTestApp, registerUser, resetDatabase, TestUser } from './helpers';

const DAILY = [0, 1, 2, 3, 4, 5, 6];
const today = () => localDateString('Asia/Ulaanbaatar');

interface OpResult {
  operationId: string;
  status: string;
  errorCode: string | null;
  message: string | null;
  replayed: boolean;
  data: Record<string, unknown> | null;
}

describe('Offline sync (e2e)', () => {
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

  async function habit(user: TestUser, body: Record<string, unknown> = {}) {
    const res = await http()
      .post(`${API}/habits`)
      .set(auth(user))
      .send({
        title: `Офлайн ${randomUUID().slice(0, 4)}`,
        type: 'PERSONAL',
        scheduleDays: DAILY,
        ...body,
      })
      .expect(201);
    return res.body.data.id as string;
  }

  /** Lets a habit accept backfilled dates (habits normally start today). */
  async function startedDaysAgo(habitId: string, days: number) {
    await prisma.habit.update({
      where: { id: habitId },
      data: { startDate: toDbDate(addDays(today(), -days)) },
    });
  }

  const completionOp = (
    habitId: string,
    localDate = today(),
    extra: Record<string, unknown> = {},
  ) => ({
    operationId: randomUUID(),
    type: 'HABIT_COMPLETION',
    createdAt: new Date().toISOString(),
    payload: { habitId, localDate, idempotencyKey: randomUUID(), ...extra },
  });

  async function push(user: TestUser, operations: unknown[]): Promise<OpResult[]> {
    const res = await http()
      .post(`${API}/sync/push`)
      .set(auth(user))
      .send({ operations })
      .expect(200);
    return res.body.data.results as OpResult[];
  }

  it('processes an offline completion with the normal XP, streak and quest rules', async () => {
    const me = await registerUser(app);
    const h = await habit(me, { difficulty: 'MEDIUM' });
    const op = completionOp(h);
    const [r] = await push(me, [op]);
    expect(r).toMatchObject({ operationId: op.operationId, status: 'PROCESSED', replayed: false });
    expect(r.data).toMatchObject({
      habitId: h,
      localDate: today(),
      rewards: { personalXP: 20, petXP: 20 },
    });

    const stored = await prisma.habitCompletion.findFirstOrThrow({ where: { habitId: h } });
    expect(stored.source).toBe('OFFLINE_SYNC');
    expect(stored.clientCreatedAt).not.toBeNull();
  });

  it('replays the same operation without granting XP twice', async () => {
    const me = await registerUser(app);
    const h = await habit(me);
    const op = completionOp(h);
    await push(me, [op]);
    const before = await prisma.userGamification.findUniqueOrThrow({ where: { userId: me.id } });

    const [again] = await push(me, [op]);
    expect(again).toMatchObject({ status: 'PROCESSED', replayed: true });
    const after = await prisma.userGamification.findUniqueOrThrow({ where: { userId: me.id } });
    expect(after.lifetimeXP).toBe(before.lifetimeXP);
    expect(await prisma.habitCompletion.count({ where: { habitId: h } })).toBe(1);
  });

  it('is idempotent with an online request that already reached the server', async () => {
    const me = await registerUser(app);
    const h = await habit(me);
    const key = randomUUID();
    // The phone sent it online, lost the response, then queued it offline with the same key.
    await http()
      .post(`${API}/habits/${h}/completions`)
      .set(auth(me))
      .send({ idempotencyKey: key })
      .expect(201);
    const [r] = await push(me, [completionOp(h, today(), { idempotencyKey: key })]);
    expect(r).toMatchObject({ status: 'PROCESSED' });
    expect(r.data).toMatchObject({ replayed: true });
    expect(
      await prisma.xPTransaction.count({
        where: { userId: me.id, sourceType: 'HABIT_COMPLETION' },
      }),
    ).toBe(1);
  });

  it('backfills past days inside the window and rebuilds the streak', async () => {
    const me = await registerUser(app);
    const h = await habit(me);
    await startedDaysAgo(h, 5);
    const results = await push(me, [
      completionOp(h, addDays(today(), -2)),
      completionOp(h, addDays(today(), -1)),
      completionOp(h, today()),
    ]);
    expect(results.map((r) => r.status)).toEqual(['PROCESSED', 'PROCESSED', 'PROCESSED']);
    expect(results[2].data).toMatchObject({ streak: { current: 3, longest: 3 } });
  });

  it('rejects dates outside the window and in the future, per operation', async () => {
    const me = await registerUser(app);
    const h = await habit(me);
    await startedDaysAgo(h, 10);
    const [old, future, ok] = await push(me, [
      completionOp(h, addDays(today(), -4)),
      completionOp(h, addDays(today(), 1)),
      completionOp(h, today()),
    ]);
    expect(old).toMatchObject({ status: 'REJECTED', errorCode: 'DATE_OUT_OF_RANGE' });
    expect(old.message).toContain('3 хоногийн');
    expect(future).toMatchObject({ status: 'REJECTED', errorCode: 'DATE_OUT_OF_RANGE' });
    expect(ok.status).toBe('PROCESSED'); // partial batch success
  });

  it('reports a SHARED family habit done by someone else as a conflict with an explanation', async () => {
    const owner = await registerUser(app, { displayName: 'Ээж' });
    const child = await registerUser(app, { displayName: 'Охин' });
    await http()
      .post(`${API}/families`)
      .set(auth(owner))
      .send({ name: 'Синк гэр бүл' })
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
    const h = await habit(owner, { type: 'FAMILY', completionMode: 'SHARED', title: 'Хог гаргах' });

    // Mum completed online while the child was offline.
    await http()
      .post(`${API}/habits/${h}/completions`)
      .set(auth(owner))
      .send({ idempotencyKey: randomUUID() })
      .expect(201);
    const [r] = await push(child, [completionOp(h)]);
    expect(r).toMatchObject({ status: 'CONFLICT', errorCode: 'ALREADY_COMPLETED' });
    expect(r.message).toContain('Ээж');
    expect(await prisma.xPTransaction.count({ where: { userId: child.id } })).toBe(0);
  });

  it('applies an offline undo after the completion and validates payloads', async () => {
    const me = await registerUser(app);
    const h = await habit(me);
    const [done] = await push(me, [completionOp(h)]);
    const completionId = done.data!.completionId as string;

    const later = new Date(Date.now() + 1000).toISOString();
    const [undo, bad, unknownHabit] = await push(me, [
      {
        operationId: randomUUID(),
        type: 'COMPLETION_UNDO',
        createdAt: later,
        payload: { completionId },
      },
      {
        operationId: randomUUID(),
        type: 'HABIT_COMPLETION',
        createdAt: later,
        payload: { habitId: 'nope' },
      },
      completionOp(randomUUID()),
    ]);
    expect(undo).toMatchObject({ status: 'PROCESSED' });
    expect(undo.data).toMatchObject({ rewards: { personalXP: -10, petXP: -10 } });
    expect(bad).toMatchObject({ status: 'REJECTED', errorCode: 'VALIDATION_ERROR' });
    expect(unknownHabit).toMatchObject({ status: 'REJECTED', errorCode: 'HABIT_NOT_FOUND' });
    expect(await prisma.habitCompletion.count({ where: { habitId: h } })).toBe(0);
  });

  it('syncs pet care and reports the cooldown as a conflict', async () => {
    const me = await registerUser(app);
    const care = (type: string) => ({
      operationId: randomUUID(),
      type: 'PET_CARE',
      createdAt: new Date().toISOString(),
      payload: { type, idempotencyKey: randomUUID() },
    });
    const [first, second] = await push(me, [care('PLAY'), care('PLAY')]);
    expect(first).toMatchObject({ status: 'PROCESSED', data: { petXP: 15 } });
    expect(second).toMatchObject({ status: 'CONFLICT', errorCode: 'CARE_COOLDOWN' });
  });

  it('keeps users apart: operation ids and habits are per user', async () => {
    const a = await registerUser(app);
    const b = await registerUser(app);
    const h = await habit(a);
    const op = completionOp(h);
    await push(a, [op]);
    // b cannot complete a's private habit, even replaying a's operation id.
    const [r] = await push(b, [op]);
    expect(r).toMatchObject({ status: 'REJECTED', errorCode: 'HABIT_NOT_FOUND' });
  });

  it('validates the batch envelope', async () => {
    const me = await registerUser(app);
    await http().post(`${API}/sync/push`).set(auth(me)).send({ operations: [] }).expect(400);
    await http()
      .post(`${API}/sync/push`)
      .set(auth(me))
      .send({
        operations: [{ operationId: 'x', type: 'HACK', createdAt: 'yesterday', payload: {} }],
      })
      .expect(400);
    await http().post(`${API}/sync/push`).send({ operations: [] }).expect(401);
  });

  it('serves a pull snapshot and a status summary', async () => {
    const me = await registerUser(app);
    const h = await habit(me);
    await push(me, [completionOp(h), completionOp(randomUUID())]);

    const pull = await http().get(`${API}/sync/pull`).set(auth(me)).expect(200);
    expect(pull.body.data).toMatchObject({ family: null, members: [], pendingOperations: 0 });
    expect(pull.body.data.habits.find((x: { id: string }) => x.id === h).today.isCompleted).toBe(
      true,
    );
    expect(pull.body.data.gamification.lifetimeXP).toBeGreaterThan(0);

    const status = await http().get(`${API}/sync/status`).set(auth(me)).expect(200);
    expect(status.body.data).toMatchObject({
      offlineWindowDays: 3,
      counts: { PROCESSED: 1, REJECTED: 1 },
    });
    expect(status.body.data.recent).toHaveLength(2);
  });
});
