import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import { PrismaService } from '../src/database/prisma.service';
import { API, auth, createTestApp, registerUser, resetDatabase, TestUser } from './helpers';

describe('Families & invites (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const http = () => request(app.getHttpServer());

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
    await resetDatabase(prisma);
  });

  afterAll(async () => {
    await app.close();
  });

  async function createFamily(user: TestUser, name = 'Гэр бүл') {
    const res = await http().post(`${API}/families`).set(auth(user)).send({ name }).expect(201);
    return res.body.data as { id: string; myMemberId: string };
  }

  async function invite(user: TestUser, body: Record<string, unknown> = {}) {
    const res = await http().post(`${API}/families/current/invites`).set(auth(user)).send(body);
    return res;
  }

  async function join(user: TestUser, code: string) {
    return http().post(`${API}/families/join`).set(auth(user)).send({ code });
  }

  async function members(user: TestUser) {
    const res = await http().get(`${API}/families/current/members`).set(auth(user)).expect(200);
    return res.body.data as Array<{ id: string; userId: string; role: string; isMe: boolean }>;
  }

  describe('create & read', () => {
    it('returns NOT_IN_FAMILY before joining any family', async () => {
      const user = await registerUser(app);
      const res = await http().get(`${API}/families/current`).set(auth(user)).expect(404);
      expect(res.body.error.code).toBe('NOT_IN_FAMILY');
    });

    it('creates a family with the creator as OWNER and enforces one family per user', async () => {
      const owner = await registerUser(app);
      const res = await http()
        .post(`${API}/families`)
        .set(auth(owner))
        .send({ name: '  Батын гэр бүл ', avatarKey: 'ger' })
        .expect(201);
      expect(res.body.data).toMatchObject({
        name: 'Батын гэр бүл',
        avatarKey: 'ger',
        myRole: 'OWNER',
        memberCount: 1,
        plan: 'FREE',
        gamification: { level: 1, lifetimeXP: 0 },
      });

      const second = await http()
        .post(`${API}/families`)
        .set(auth(owner))
        .send({ name: 'Өөр' })
        .expect(409);
      expect(second.body.error.code).toBe('ALREADY_IN_FAMILY');

      const me = await http().get(`${API}/auth/me`).set(auth(owner)).expect(200);
      expect(me.body.data.family).toMatchObject({ role: 'OWNER', name: 'Батын гэр бүл' });

      const audit = await prisma.auditLog.count({
        where: { action: 'FAMILY_CREATED', actorId: owner.id },
      });
      expect(audit).toBe(1);
    });

    it('rejects concurrent family creation by the same user', async () => {
      const user = await registerUser(app);
      const results = await Promise.all([
        http().post(`${API}/families`).set(auth(user)).send({ name: 'A' }),
        http().post(`${API}/families`).set(auth(user)).send({ name: 'B' }),
      ]);
      expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
      expect(await prisma.familyMember.count({ where: { userId: user.id } })).toBe(1);
    });
  });

  describe('invites & joining', () => {
    let owner: TestUser;

    beforeAll(async () => {
      owner = await registerUser(app);
      await createFamily(owner, 'Урилгын гэр бүл');
    });

    it('joins with a code typed in lower case without the dash, then the code is used up', async () => {
      const created = await invite(owner, { role: 'CHILD' });
      expect(created.status).toBe(201);
      const code = created.body.data.code as string;
      expect(code).toMatch(/^[0-9A-Z]{5}-[0-9A-Z]{5}$/);

      // Only a hash is stored.
      const stored = await prisma.familyInvite.findUniqueOrThrow({
        where: { id: created.body.data.id },
      });
      expect(stored.tokenHash).not.toContain(code.replace('-', ''));

      const child = await registerUser(app);
      const joined = await join(child, code.replace('-', '').toLowerCase());
      expect(joined.status).toBe(200);
      expect(joined.body.data).toMatchObject({ myRole: 'CHILD', memberCount: 2 });

      const late = await registerUser(app);
      const res = await join(late, code);
      expect(res.status).toBe(410);
      expect(res.body.error.code).toBe('INVITE_USED_UP');
    });

    it('rejects joining a second family', async () => {
      const created = await invite(owner, { maxUses: 2 });
      const otherOwner = await registerUser(app);
      await createFamily(otherOwner, 'Өөр гэр бүл');
      const res = await join(otherOwner, created.body.data.code);
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('ALREADY_IN_FAMILY');
    });

    it('rejects unknown, revoked and expired codes', async () => {
      const user = await registerUser(app);
      expect((await join(user, 'AAAAA-BBBBB')).body.error.code).toBe('INVITE_INVALID');
      expect((await join(user, 'short')).body.error.code).toBe('INVITE_INVALID');

      const revoked = await invite(owner);
      await http()
        .delete(`${API}/families/current/invites/${revoked.body.data.id}`)
        .set(auth(owner))
        .expect(200);
      const r1 = await join(user, revoked.body.data.code);
      expect(r1.status).toBe(404);
      expect(r1.body.error.code).toBe('INVITE_INVALID');

      const expired = await invite(owner);
      await prisma.familyInvite.update({
        where: { id: expired.body.data.id },
        data: { expiresAt: new Date(Date.now() - 1000) },
      });
      const r2 = await join(user, expired.body.data.code);
      expect(r2.status).toBe(410);
      expect(r2.body.error.code).toBe('INVITE_EXPIRED');
    });

    it('lets exactly one of two concurrent joins use a single-use code', async () => {
      const created = await invite(owner, { maxUses: 1 });
      const [a, b] = await Promise.all([registerUser(app), registerUser(app)]);
      const results = await Promise.all([
        join(a, created.body.data.code),
        join(b, created.body.data.code),
      ]);
      expect(results.map((r) => r.status).sort()).toEqual([200, 410]);
      const stored = await prisma.familyInvite.findUniqueOrThrow({
        where: { id: created.body.data.id },
      });
      expect(stored.usedCount).toBe(1);
    });

    it('lists only active invites and never exposes codes', async () => {
      const res = await http().get(`${API}/families/current/invites`).set(auth(owner)).expect(200);
      expect(res.body.data.length).toBeGreaterThan(0);
      for (const i of res.body.data) {
        expect(i.code).toBeUndefined();
        expect(i.usedCount).toBeLessThan(i.maxUses);
      }
    });
  });

  describe('roles & permissions', () => {
    let owner: TestUser;
    let parent: TestUser;
    let member: TestUser;
    let child: TestUser;

    beforeAll(async () => {
      owner = await registerUser(app);
      await createFamily(owner, 'Эрхийн гэр бүл');
      for (const [role, set] of [
        ['PARENT', (u: TestUser) => (parent = u)],
        ['MEMBER', (u: TestUser) => (member = u)],
        ['CHILD', (u: TestUser) => (child = u)],
      ] as const) {
        const u = await registerUser(app);
        const code = (await invite(owner, { role })).body.data.code;
        expect((await join(u, code)).status).toBe(200);
        set(u);
      }
    });

    const memberIdOf = async (viewer: TestUser, target: TestUser) =>
      (await members(viewer)).find((m) => m.userId === target.id)!.id;

    it('lists members ordered by role and marks the caller', async () => {
      const list = await members(child);
      expect(list.map((m) => m.role)).toEqual(['OWNER', 'PARENT', 'MEMBER', 'CHILD']);
      expect(list.filter((m) => m.isMe)).toHaveLength(1);
    });

    it('limits who can invite which role', async () => {
      expect((await invite(member)).status).toBe(403);
      expect((await invite(child)).status).toBe(403);
      expect((await invite(parent, { role: 'PARENT' })).status).toBe(403);
      expect((await invite(parent, { role: 'CHILD' })).status).toBe(201);
      expect((await invite(owner, { role: 'OWNER' })).status).toBe(400);
    });

    it('limits family updates to OWNER/PARENT', async () => {
      await http()
        .patch(`${API}/families/current`)
        .set(auth(child))
        .send({ name: 'X' })
        .expect(403);
      const res = await http()
        .patch(`${API}/families/current`)
        .set(auth(parent))
        .send({ name: 'Шинэ нэр', timezone: 'Asia/Tokyo' })
        .expect(200);
      expect(res.body.data).toMatchObject({ name: 'Шинэ нэр', timezone: 'Asia/Tokyo' });
    });

    it('protects role changes', async () => {
      const memberId = await memberIdOf(owner, member);
      await http()
        .patch(`${API}/families/current/members/${memberId}`)
        .set(auth(parent))
        .send({ role: 'CHILD' })
        .expect(403);
      await http()
        .patch(`${API}/families/current/members/${memberId}`)
        .set(auth(owner))
        .send({ role: 'OWNER' })
        .expect(400);
      const res = await http()
        .patch(`${API}/families/current/members/${memberId}`)
        .set(auth(owner))
        .send({ role: 'PARENT' })
        .expect(200);
      expect(res.body.data.find((m: { userId: string }) => m.userId === member.id).role).toBe(
        'PARENT',
      );
      await http()
        .patch(`${API}/families/current/members/${memberId}`)
        .set(auth(owner))
        .send({ role: 'MEMBER' })
        .expect(200);
    });

    it('limits member removal by role', async () => {
      const ownerMemberId = await memberIdOf(child, owner);
      const parentMemberId = await memberIdOf(child, parent);
      await http()
        .delete(`${API}/families/current/members/${parentMemberId}`)
        .set(auth(child))
        .expect(403);
      await http()
        .delete(`${API}/families/current/members/${ownerMemberId}`)
        .set(auth(parent))
        .expect(403);
      await http()
        .delete(`${API}/families/current/members/not-a-uuid`)
        .set(auth(owner))
        .expect(400);
    });

    it('isolates families: ids from another family look like they do not exist', async () => {
      const outsider = await registerUser(app);
      await createFamily(outsider, 'Гадны гэр бүл');
      const childMemberId = await memberIdOf(owner, child);

      const res = await http()
        .delete(`${API}/families/current/members/${childMemberId}`)
        .set(auth(outsider))
        .expect(404);
      expect(res.body.error.code).toBe('MEMBER_NOT_FOUND');
      await http()
        .patch(`${API}/families/current/members/${childMemberId}`)
        .set(auth(outsider))
        .send({ role: 'MEMBER' })
        .expect(404);

      const outsiderMembers = await members(outsider);
      expect(outsiderMembers.map((m) => m.userId)).toEqual([outsider.id]);
    });

    it('requires the owner to transfer ownership before leaving', async () => {
      const ownerMemberId = await memberIdOf(owner, owner);
      const blocked = await http()
        .delete(`${API}/families/current/members/${ownerMemberId}`)
        .set(auth(owner))
        .expect(409);
      expect(blocked.body.error.code).toBe('OWNER_MUST_TRANSFER');

      const childMemberId = await memberIdOf(owner, child);
      await http()
        .post(`${API}/families/current/transfer-ownership`)
        .set(auth(owner))
        .send({ memberId: childMemberId })
        .expect(403);

      const parentMemberId = await memberIdOf(owner, parent);
      const res = await http()
        .post(`${API}/families/current/transfer-ownership`)
        .set(auth(owner))
        .send({ memberId: parentMemberId })
        .expect(200);
      const roles = Object.fromEntries(
        res.body.data.map((m: { userId: string; role: string }) => [m.userId, m.role]),
      );
      expect(roles[parent.id]).toBe('OWNER');
      expect(roles[owner.id]).toBe('PARENT');
      expect(await prisma.auditLog.count({ where: { action: 'OWNERSHIP_TRANSFERRED' } })).toBe(1);
    });

    it('lets a parent remove a child and a member leave on their own', async () => {
      const childMemberId = await memberIdOf(owner, child);
      const removed = await http()
        .delete(`${API}/families/current/members/${childMemberId}`)
        .set(auth(owner)) // owner is PARENT now
        .expect(200);
      expect(removed.body.data.familyDissolved).toBe(false);
      await http().get(`${API}/families/current`).set(auth(child)).expect(404);

      const memberMemberId = await memberIdOf(member, member);
      await http()
        .delete(`${API}/families/current/members/${memberMemberId}`)
        .set(auth(member))
        .expect(200);
      expect((await members(parent)).map((m) => m.userId).sort()).toEqual(
        [owner.id, parent.id].sort(),
      );
    });
  });

  it('dissolves the family when the last member (owner) leaves, freeing the user', async () => {
    const solo = await registerUser(app);
    const family = await createFamily(solo, 'Ганцаараа');
    const pending = await invite(solo);

    const res = await http()
      .delete(`${API}/families/current/members/${family.myMemberId}`)
      .set(auth(solo))
      .expect(200);
    expect(res.body.data.familyDissolved).toBe(true);

    const stored = await prisma.family.findUniqueOrThrow({ where: { id: family.id } });
    expect(stored.deletedAt).not.toBeNull();

    const joiner = await registerUser(app);
    expect((await join(joiner, pending.body.data.code)).status).toBe(404);

    await createFamily(solo, 'Шинэ эхлэл');
  });

  it('keeps the XP ledger append-only at the database level', async () => {
    const user = await registerUser(app);
    const tx = await prisma.xPTransaction.create({
      data: {
        walletType: 'PERSONAL',
        kind: 'EARN',
        userId: user.id,
        amount: 10,
        sourceType: 'ADMIN_ADJUSTMENT',
        idempotencyKey: `test:${user.id}`,
      },
    });
    await expect(
      prisma.xPTransaction.update({ where: { id: tx.id }, data: { amount: 999 } }),
    ).rejects.toThrow();
    await expect(prisma.xPTransaction.delete({ where: { id: tx.id } })).rejects.toThrow();
    // Wallet/owner mismatch is rejected by a CHECK constraint.
    await expect(
      prisma.xPTransaction.create({
        data: {
          walletType: 'FAMILY',
          kind: 'EARN',
          userId: user.id,
          amount: 10,
          sourceType: 'ADMIN_ADJUSTMENT',
          idempotencyKey: `test2:${user.id}`,
        },
      }),
    ).rejects.toThrow();
  });
});
