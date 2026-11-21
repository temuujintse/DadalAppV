import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import { PrismaService } from '../src/database/prisma.service';
import { API, auth, createTestApp, registerUser, resetDatabase } from './helpers';

describe('Auth (e2e)', () => {
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

  it('registers a user, lower-cases the e-mail and never returns the password hash', async () => {
    const res = await http()
      .post(`${API}/auth/register`)
      .send({ email: 'Bold@Example.COM', password: 'secret123', displayName: '  Болд  ' })
      .expect(201);

    expect(res.body.success).toBe(true);
    expect(res.body.data.user).toMatchObject({
      email: 'bold@example.com',
      profile: { displayName: 'Болд', timezone: 'Asia/Ulaanbaatar', avatarKey: 'fox' },
      family: null,
      gamification: { level: 1, lifetimeXP: 0, balanceXP: 0 },
    });
    expect(JSON.stringify(res.body)).not.toContain('passwordHash');
    expect(res.body.data.tokens.refreshToken).toMatch(/^[0-9a-f-]{36}\..+/);

    const stored = await prisma.user.findUniqueOrThrow({ where: { email: 'bold@example.com' } });
    expect(stored.passwordHash).toMatch(/^\$argon2id\$/);
  });

  it('rejects a duplicate e-mail regardless of case', async () => {
    const res = await http()
      .post(`${API}/auth/register`)
      .send({ email: 'BOLD@example.com', password: 'secret123', displayName: 'Болд 2' })
      .expect(409);
    expect(res.body.error.code).toBe('EMAIL_TAKEN');
  });

  it('returns field-level validation errors and rejects unknown fields', async () => {
    const res = await http()
      .post(`${API}/auth/register`)
      .send({
        email: 'nope',
        password: 'short',
        displayName: '',
        isAdmin: true,
        timezone: 'Mars/X',
      })
      .expect(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    const fields = res.body.error.details.map((d: { field: string }) => d.field);
    expect(fields).toEqual(
      expect.arrayContaining(['email', 'password', 'displayName', 'isAdmin', 'timezone']),
    );
  });

  it('uses the same error for a wrong password and an unknown e-mail', async () => {
    const wrongPassword = await http()
      .post(`${API}/auth/login`)
      .send({ email: 'bold@example.com', password: 'wrong-pass1' })
      .expect(401);
    const unknownEmail = await http()
      .post(`${API}/auth/login`)
      .send({ email: 'ghost@example.com', password: 'secret123' })
      .expect(401);
    expect(wrongPassword.body.error).toMatchObject({ code: 'INVALID_CREDENTIALS' });
    expect(unknownEmail.body.error.code).toBe(wrongPassword.body.error.code);
    expect(unknownEmail.body.error.message).toBe(wrongPassword.body.error.message);
  });

  it('logs in and serves /auth/me and /users/me', async () => {
    const login = await http()
      .post(`${API}/auth/login`)
      .send({ email: 'BOLD@example.com', password: 'secret123' })
      .expect(200);
    const token = login.body.data.tokens.accessToken as string;

    const me = await http()
      .get(`${API}/auth/me`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(me.body.data.email).toBe('bold@example.com');
    await http().get(`${API}/users/me`).set('Authorization', `Bearer ${token}`).expect(200);
  });

  it('rejects requests without or with a forged token', async () => {
    const missing = await http().get(`${API}/auth/me`).expect(401);
    expect(missing.body.error.code).toBe('UNAUTHORIZED');
    const forged = await http()
      .get(`${API}/auth/me`)
      .set('Authorization', 'Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ4In0.bad')
      .expect(401);
    expect(forged.body.error.code).toBe('TOKEN_INVALID');
  });

  it('rotates refresh tokens and revokes the session when an old one is replayed', async () => {
    const user = await registerUser(app);

    const first = await http()
      .post(`${API}/auth/refresh`)
      .send({ refreshToken: user.refreshToken })
      .expect(200);
    const rotated = first.body.data;
    expect(rotated.refreshToken).not.toBe(user.refreshToken);
    await http()
      .get(`${API}/auth/me`)
      .set('Authorization', `Bearer ${rotated.accessToken}`)
      .expect(200);

    // Replay the original (already rotated) token → theft detection.
    const replay = await http()
      .post(`${API}/auth/refresh`)
      .send({ refreshToken: user.refreshToken })
      .expect(401);
    expect(replay.body.error.code).toBe('SESSION_REVOKED');

    // The whole session is now dead — including the freshly rotated tokens.
    await http()
      .get(`${API}/auth/me`)
      .set('Authorization', `Bearer ${rotated.accessToken}`)
      .expect(401);
    await http()
      .post(`${API}/auth/refresh`)
      .send({ refreshToken: rotated.refreshToken })
      .expect(401);

    const audit = await prisma.auditLog.findFirst({
      where: { action: 'SESSION_REUSE_DETECTED', actorId: user.id },
    });
    expect(audit).not.toBeNull();
  });

  it('logout revokes only the current session', async () => {
    const user = await registerUser(app, { email: 'multi@example.com' });
    const second = await http()
      .post(`${API}/auth/login`)
      .send({ email: 'multi@example.com', password: 'secret123' })
      .expect(200);

    await http().post(`${API}/auth/logout`).set(auth(user)).expect(200);

    const after = await http().get(`${API}/auth/me`).set(auth(user)).expect(401);
    expect(after.body.error.code).toBe('SESSION_REVOKED');
    await http().post(`${API}/auth/refresh`).send({ refreshToken: user.refreshToken }).expect(401);

    // The other device stays signed in.
    await http()
      .get(`${API}/auth/me`)
      .set('Authorization', `Bearer ${second.body.data.tokens.accessToken}`)
      .expect(200);
  });

  it('rejects malformed refresh tokens', async () => {
    const res = await http()
      .post(`${API}/auth/refresh`)
      .send({ refreshToken: 'garbage' })
      .expect(401);
    expect(res.body.error.code).toBe('TOKEN_INVALID');
  });

  it('updates the profile and completes onboarding once', async () => {
    const user = await registerUser(app);
    const res = await http()
      .patch(`${API}/users/me`)
      .set(auth(user))
      .send({
        displayName: 'Сараа',
        avatarKey: 'panda',
        timezone: 'Europe/Berlin',
        onboardingCompleted: true,
      })
      .expect(200);
    expect(res.body.data.profile).toMatchObject({
      displayName: 'Сараа',
      avatarKey: 'panda',
      timezone: 'Europe/Berlin',
    });
    const completedAt = res.body.data.profile.onboardingCompletedAt;
    expect(completedAt).toBeTruthy();

    const again = await http()
      .patch(`${API}/users/me`)
      .set(auth(user))
      .send({ onboardingCompleted: true })
      .expect(200);
    expect(again.body.data.profile.onboardingCompletedAt).toBe(completedAt);

    await http().patch(`${API}/users/me`).set(auth(user)).send({ avatarKey: 'dragon' }).expect(400);
  });

  it('exposes a public health check and a request id header', async () => {
    const res = await http().get(`${API}/health`).expect(200);
    expect(res.body.data.database).toBe('up');
    expect(res.headers['x-request-id']).toBeTruthy();
  });
});
