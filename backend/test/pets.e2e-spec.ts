import { INestApplication } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import type { App } from 'supertest/types';
import { seedReferenceData } from '../prisma/seed-data';
import { PrismaService } from '../src/database/prisma.service';
import { API, auth, createTestApp, registerUser, resetDatabase, TestUser } from './helpers';

const DAILY = [0, 1, 2, 3, 4, 5, 6];

describe('Pet (e2e)', () => {
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

  const care = (user: TestUser, type: string, key: string = randomUUID()) =>
    http().post(`${API}/pet/me/care`).set(auth(user)).send({ type, idempotencyKey: key });

  async function accessoryId(key: string) {
    return (await prisma.petAccessory.findUniqueOrThrow({ where: { key } })).id;
  }

  describe('profile & care', () => {
    let me: TestUser;

    beforeAll(async () => {
      me = await registerUser(app);
    });

    it('creates the pet on first access with the default accessory unlocked', async () => {
      const res = await http().get(`${API}/pet/me`).set(auth(me)).expect(200);
      expect(res.body.data).toMatchObject({
        name: 'Бамбаа',
        species: 'FOX',
        level: 1,
        lifetimeXP: 0,
        xpForNextLevel: 100,
        happiness: 80,
        mood: 'HAPPY',
        equipped: [],
        accessoriesUnlocked: 1,
        accessoriesTotal: 7,
      });
      expect(res.body.data.care.map((c: { type: string }) => c.type).sort()).toEqual([
        'BATH',
        'FEED',
        'PET',
        'PLAY',
      ]);
      // A second call must not create a second pet.
      await http().get(`${API}/pet/me`).set(auth(me)).expect(200);
      expect(await prisma.userPet.count({ where: { userId: me.id } })).toBe(1);
    });

    it('renames and changes species with validation', async () => {
      const res = await http()
        .patch(`${API}/pet/me`)
        .set(auth(me))
        .send({ name: '  Шар  ', species: 'SNOW_FOX' })
        .expect(200);
      expect(res.body.data).toMatchObject({ name: 'Шар', species: 'SNOW_FOX' });
      await http().patch(`${API}/pet/me`).set(auth(me)).send({ species: 'DRAGON' }).expect(400);
      await http().patch(`${API}/pet/me`).set(auth(me)).send({ name: '' }).expect(400);
    });

    it('awards pet XP and happiness for care, enforces the cooldown, replays idempotently', async () => {
      const key = randomUUID();
      const first = await care(me, 'PLAY', key).expect(200);
      expect(first.body.data).toMatchObject({
        type: 'PLAY',
        petXP: 15,
        happinessDelta: 20,
        replayed: false,
        pet: { lifetimeXP: 15, happiness: 100 },
      });
      const play = first.body.data.pet.care.find((c: { type: string }) => c.type === 'PLAY');
      expect(play.availableAt).toBeTruthy();

      const replay = await care(me, 'PLAY', key).expect(200);
      expect(replay.body.data).toMatchObject({ replayed: true, petXP: 15 });

      const cooldown = await care(me, 'PLAY').expect(429);
      expect(cooldown.body.error.code).toBe('CARE_COOLDOWN');
      expect(cooldown.body.error.details.availableAt).toBeTruthy();

      // Other care types have their own cooldowns.
      await care(me, 'FEED').expect(200);

      const pet = await prisma.userPet.findUniqueOrThrow({ where: { userId: me.id } });
      const ledger = await prisma.xPTransaction.findMany({ where: { petId: pet.id } });
      expect(ledger.map((t) => [t.walletType, t.sourceType, t.amount])).toEqual(
        expect.arrayContaining([
          ['PET', 'PET_CARE', 15],
          ['PET', 'PET_CARE', 10],
        ]),
      );
      expect(ledger).toHaveLength(2);
      // Care never touches the personal wallet.
      expect(await prisma.xPTransaction.count({ where: { userId: me.id } })).toBe(0);
    });

    it('lets only one of two concurrent care taps through', async () => {
      const results = await Promise.all([care(me, 'BATH'), care(me, 'BATH')]);
      expect(results.map((r) => r.status).sort()).toEqual([200, 429]);
      const pet = await prisma.userPet.findUniqueOrThrow({ where: { userId: me.id } });
      expect(await prisma.petCareAction.count({ where: { petId: pet.id, type: 'BATH' } })).toBe(1);
    });

    it('lists pet XP history', async () => {
      const res = await http().get(`${API}/pet/me/history`).set(auth(me)).expect(200);
      expect(res.body.data.map((h: { title: string }) => h.title)).toEqual(
        expect.arrayContaining(['Тоглосон', 'Хооллосон', 'Угаасан']),
      );
    });

    it('rejects unknown care types', async () => {
      await care(me, 'TICKLE').expect(400);
    });
  });

  describe('habit completions grow the pet', () => {
    it('awards pet XP with the completion, reverses it on undo and keeps happiness', async () => {
      const me = await registerUser(app);
      const habit = await http()
        .post(`${API}/habits`)
        .set(auth(me))
        .send({ title: 'Ном унших', type: 'PERSONAL', difficulty: 'HARD', scheduleDays: DAILY })
        .expect(201);
      const res = await http()
        .post(`${API}/habits/${habit.body.data.id}/completions`)
        .set(auth(me))
        .send({ idempotencyKey: randomUUID() })
        .expect(201);
      expect(res.body.data.rewards.petXP).toBe(30);
      expect(res.body.data.pet).toMatchObject({ lifetimeXP: 30, level: 1, happiness: 85 });
      // DEFAULT accessory unlocks when the pet is created during the completion.
      expect(res.body.data.accessoriesUnlocked.map((a: { key: string }) => a.key)).toEqual([
        'red_scarf',
      ]);

      const completionId = res.body.data.completion.id as string;
      const undo = await http()
        .delete(`${API}/completions/${completionId}`)
        .set(auth(me))
        .expect(200);
      expect(undo.body.data.rewards.petXP).toBe(-30);
      const pet = await http().get(`${API}/pet/me`).set(auth(me)).expect(200);
      expect(pet.body.data).toMatchObject({ lifetimeXP: 0, accessoriesUnlocked: 1 });
      expect(pet.body.data.happiness).toBeGreaterThanOrEqual(84);
    });

    it('unlocks level-gated accessories and never removes them', async () => {
      const me = await registerUser(app);
      await http().get(`${API}/pet/me`).set(auth(me)).expect(200);
      const pet = await prisma.userPet.findUniqueOrThrow({ where: { userId: me.id } });
      // Pet level 2 needs 100 pet XP — simulate earned XP directly in the aggregate.
      await prisma.userPet.update({ where: { id: pet.id }, data: { lifetimeXP: 100, level: 2 } });

      const list = await http().get(`${API}/pet/me/accessories`).set(auth(me)).expect(200);
      const byKey = Object.fromEntries(list.body.data.map((a: { key: string }) => [a.key, a]));
      expect(byKey.party_hat).toMatchObject({
        unlocked: true,
        requirement: 'Pet 2-р түвшин',
      });
      expect(byKey.sunglasses).toMatchObject({ unlocked: false, progress: 0.5 });
      expect(byKey.golden_crown.unlocked).toBe(false);

      // Even if XP were later reversed, owned accessories stay.
      await prisma.userPet.update({ where: { id: pet.id }, data: { lifetimeXP: 0, level: 1 } });
      const again = await http().get(`${API}/pet/me/accessories`).set(auth(me)).expect(200);
      expect(again.body.data.find((a: { key: string }) => a.key === 'party_hat').unlocked).toBe(
        true,
      );
    });
  });

  describe('accessories', () => {
    let me: TestUser;

    beforeAll(async () => {
      me = await registerUser(app);
      await http().get(`${API}/pet/me`).set(auth(me)).expect(200);
      const pet = await prisma.userPet.findUniqueOrThrow({ where: { userId: me.id } });
      await prisma.userPet.update({ where: { id: pet.id }, data: { lifetimeXP: 250, level: 3 } });
      await http().get(`${API}/pet/me/accessories`).set(auth(me)).expect(200); // sync unlocks
    });

    it('equips one item per slot and replaces the previous one', async () => {
      const scarf = await accessoryId('red_scarf');
      const hat = await accessoryId('party_hat');
      const r1 = await http()
        .post(`${API}/pet/me/accessories/${scarf}/equip`)
        .set(auth(me))
        .expect(200);
      expect(r1.body.data.equipped.map((e: { key: string }) => e.key)).toEqual(['red_scarf']);
      const r2 = await http()
        .post(`${API}/pet/me/accessories/${hat}/equip`)
        .set(auth(me))
        .expect(200);
      expect(r2.body.data.equipped.map((e: { key: string }) => e.key).sort()).toEqual([
        'party_hat',
        'red_scarf',
      ]);

      const off = await http()
        .post(`${API}/pet/me/accessories/${hat}/unequip`)
        .set(auth(me))
        .expect(200);
      expect(off.body.data.equipped.map((e: { key: string }) => e.key)).toEqual(['red_scarf']);
    });

    it('refuses locked or unknown accessories', async () => {
      const crown = await accessoryId('golden_crown');
      const locked = await http()
        .post(`${API}/pet/me/accessories/${crown}/equip`)
        .set(auth(me))
        .expect(403);
      expect(locked.body.error.code).toBe('ACCESSORY_LOCKED');
      await http()
        .post(`${API}/pet/me/accessories/${randomUUID()}/equip`)
        .set(auth(me))
        .expect(404);
    });

    it('keeps pets private to their owner', async () => {
      const other = await registerUser(app);
      const res = await http().get(`${API}/pet/me`).set(auth(other)).expect(200);
      expect(res.body.data.equipped).toEqual([]);
      expect(res.body.data.lifetimeXP).toBe(0);
    });
  });
});
