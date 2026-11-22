import { INestApplication } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AI_PROVIDER, AIProviderError, AIRequest } from '../src/ai/ai-provider.interface';
import { addDays, toDbDate } from '../src/common/utils/local-date';
import { localDateString } from '../src/common/utils/timezone.util';
import { PrismaService } from '../src/database/prisma.service';
import { StubProvider } from './ai-stub';
import { API, auth, createTestApp, registerUser, resetDatabase, TestUser } from './helpers';

const DAILY = [0, 1, 2, 3, 4, 5, 6];

/** Answers each AI feature by its schema name. */
function planFor(req: AIRequest) {
  const refs = (
    req.schema.properties as Record<string, { items: { properties: { ref: { enum: string[] } } } }>
  ).items.items.properties.ref.enum;
  return {
    summary: 'Өнөөдөр тайван, жигд хуваарь.',
    items: refs.map((ref, i) => ({ ref, startTime: '23:30', durationMinutes: 10 + i, note: '' })),
  };
}

describe('AI planner, pet companion and analytics (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const stub = new StubProvider();
  const http = () => request(app.getHttpServer());

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp((b) => b.overrideProvider(AI_PROVIDER).useValue(stub)));
    await resetDatabase(prisma);
  });
  afterAll(async () => {
    await app.close();
  });
  beforeEach(() => {
    stub.configured = true;
    stub.calls = [];
  });

  async function habit(u: TestUser, title: string) {
    const res = await http()
      .post(`${API}/habits`)
      .set(auth(u))
      .send({ title, type: 'PERSONAL', scheduleDays: DAILY })
      .expect(201);
    return res.body.data.id as string;
  }

  // ───────────── Planner ─────────────

  describe('planner', () => {
    const generate = (u: TestUser, key = randomUUID(), body: Record<string, unknown> = {}) =>
      http()
        .post(`${API}/ai/planner/generate`)
        .set(auth(u))
        // A full-day window keeps the test independent of the current time.
        .send({ idempotencyKey: key, availableFrom: '00:00', availableTo: '23:59', ...body });

    it("plans only today's open habits, validates times and stays idempotent", async () => {
      const u = await registerUser(app);
      await habit(u, 'Ном унших');
      const done = await habit(u, 'Ус уух');
      await http()
        .post(`${API}/habits/${done}/completions`)
        .set(auth(u))
        .send({ idempotencyKey: randomUUID() })
        .expect(201);
      stub.next = (req) => {
        const p = planFor(req);
        // Overlapping second item and an unknown ref must be handled by the backend.
        return {
          ...p,
          items: [...p.items, { ref: 'h9', startTime: '23:31', durationMinutes: 5, note: '' }],
        };
      };

      const key = randomUUID();
      const res = await generate(u, key).expect(201);
      expect(res.body.data).toMatchObject({
        status: 'DRAFT',
        summary: expect.any(String) as string,
      });
      expect(res.body.data.items.map((i: { title: string }) => i.title)).toEqual(['Ном унших']);
      const prompt = JSON.stringify(stub.calls[0].input);
      expect(prompt).not.toContain('Ус уух'); // completed today → not a candidate
      expect(prompt).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-/); // refs instead of database ids

      const again = await generate(u, key).expect(201);
      expect(again.body.data.id).toBe(res.body.data.id);
      expect(stub.calls).toHaveLength(1);
    });

    it('confirms one ACTIVE plan per day, regenerates drafts and keeps plans private', async () => {
      const u = await registerUser(app);
      const other = await registerUser(app);
      await habit(u, 'Гүйлт');
      stub.next = planFor;

      const first = (await generate(u).expect(201)).body.data;
      await http().post(`${API}/ai/planner/${first.id}/confirm`).set(auth(other)).expect(404);
      const active = await http()
        .post(`${API}/ai/planner/${first.id}/confirm`)
        .set(auth(u))
        .expect(200);
      expect(active.body.data.status).toBe('ACTIVE');

      const redo = await http()
        .post(`${API}/ai/planner/${first.id}/regenerate`)
        .set(auth(u))
        .send({ idempotencyKey: randomUUID() })
        .expect(201);
      expect(redo.body.data.status).toBe('DRAFT');
      await http().post(`${API}/ai/planner/${redo.body.data.id}/confirm`).set(auth(u)).expect(200);

      const day = await http().get(`${API}/ai/planner`).set(auth(u)).expect(200);
      expect(day.body.data.active.id).toBe(redo.body.data.id);
      expect(day.body.data.draft).toBeNull();
      expect(await prisma.aIPlan.count({ where: { userId: u.id, status: 'ACTIVE' } })).toBe(1);
    });

    it('answers without AI when nothing is left to plan, and on invalid windows', async () => {
      const u = await registerUser(app);
      const res = await generate(u).expect(409);
      expect(res.body.error.message).toContain('үлдээгүй');
      await habit(u, 'Сунгалт');
      await generate(u, randomUUID(), { availableFrom: '22:00', availableTo: '22:05' }).expect(400);
      expect(stub.calls).toHaveLength(0);
    });
  });

  // ───────────── Pet companion ─────────────

  describe('pet companion', () => {
    const interact = (u: TestUser, event?: string) =>
      http()
        .post(`${API}/ai/pet/interact`)
        .set(auth(u))
        .send(event ? { event } : {});

    it('answers everyday moments from templates without any AI call', async () => {
      const u = await registerUser(app);
      await http().get(`${API}/pet/me`).set(auth(u)).expect(200);
      const res = await interact(u).expect(200);
      expect(res.body.data).toMatchObject({ event: 'GREETING', source: 'TEMPLATE' });
      expect(['HAPPY', 'IDLE', 'CELEBRATE', 'CARE']).toContain(res.body.data.animation);
      expect((await interact(u, 'PET_CARE').expect(200)).body.data.source).toBe('TEMPLATE');
      expect(stub.calls).toHaveLength(0);
    });

    it('uses the AI once per special event and day, mapping its animation to app states', async () => {
      const u = await registerUser(app);
      await http().get(`${API}/pet/me`).set(auth(u)).expect(200);
      stub.next = () => ({
        message: 'Шинэ түвшин! Чи гайхалтай 🎉',
        emotion: 'EXCITED',
        animation: 'EXCITED',
        suggestedAction: 'VIEW_PROGRESS',
      });
      const first = await interact(u, 'LEVEL_UP').expect(200);
      expect(first.body.data).toMatchObject({
        source: 'AI',
        animation: 'CELEBRATE',
        suggestedAction: 'VIEW_PROGRESS',
      });
      const again = await interact(u, 'LEVEL_UP').expect(200);
      expect(again.body.data.message).toBe(first.body.data.message);
      expect(stub.calls).toHaveLength(1);
    });

    it('falls back to a template when the AI fails or is off', async () => {
      const u = await registerUser(app);
      await http().get(`${API}/pet/me`).set(auth(u)).expect(200);
      stub.next = () => {
        throw new AIProviderError('TIMEOUT', 'slow');
      };
      expect((await interact(u, 'DAILY_GOAL_COMPLETED').expect(200)).body.data.source).toBe(
        'TEMPLATE',
      );
      stub.configured = false;
      expect((await interact(u, 'INACTIVE_RETURN').expect(200)).body.data.source).toBe('TEMPLATE');
      await interact(u, 'HACK').expect(400);
    });
  });

  // ───────────── Analytics ─────────────

  describe('analytics', () => {
    const insight = {
      summary: 'Өнгөрсөн долоо хоногт тогтвортой байлаа.',
      positiveHighlights: ['Ном унших дадлаа хадгалсан.'],
      improvementAreas: [],
      suggestions: ['Өглөө эрт эхлээрэй.'],
      periodComparison: 'Өмнөх үетэй ойролцоо байна.',
    };

    it('returns metrics without AI when there is nothing to explain', async () => {
      const u = await registerUser(app);
      const res = await http().get(`${API}/ai/analytics/weekly`).set(auth(u)).expect(200);
      expect(res.body.data).toMatchObject({
        insightStatus: 'NO_DATA',
        insight: null,
        metrics: { scheduled: 0 },
      });
      expect(stub.calls).toHaveLength(0);
    });

    it('explains real numbers once per period and rejects invented figures', async () => {
      const u = await registerUser(app);
      const id = await habit(u, 'Ном унших');
      // Pretend the habit existed for the past weeks.
      const today = localDateString('Asia/Ulaanbaatar');
      await prisma.habit.update({
        where: { id },
        data: { startDate: toDbDate(addDays(today, -40)) },
      });

      stub.next = () => ({ ...insight, summary: 'Биелэлт 97% болж өслөө!' });
      const invented = await http().get(`${API}/ai/analytics/weekly`).set(auth(u)).expect(200);
      expect(invented.body.data).toMatchObject({ insightStatus: 'UNAVAILABLE', insight: null });
      expect(invented.body.data.metrics.scheduled).toBe(7);

      stub.next = () => insight;
      const ok = await http().get(`${API}/ai/analytics/weekly`).set(auth(u)).expect(200);
      expect(ok.body.data).toMatchObject({ insightStatus: 'READY', insight });
      const calls = stub.calls.length;
      await http().get(`${API}/ai/analytics/weekly`).set(auth(u)).expect(200);
      expect(stub.calls.length).toBe(calls); // cached for the period
      expect(stub.calls.at(-1)!.input[0].content).toContain('"completionRate":0');

      stub.configured = false;
      const monthly = await http().get(`${API}/ai/analytics/monthly`).set(auth(u)).expect(200);
      expect(monthly.body.data).toMatchObject({ insightStatus: 'DISABLED', insight: null });
      expect(monthly.body.data.metrics.periodType).toBe('MONTHLY');
    });
  });
});
