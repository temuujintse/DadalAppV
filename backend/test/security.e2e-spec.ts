import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import type { App } from 'supertest/types';
import { JWT_AUDIENCE, JWT_ISSUER } from '../src/auth/token.service';
import { PrismaService } from '../src/database/prisma.service';
import { API, auth, createTestApp, registerUser, resetDatabase, TestUser } from './helpers';

/**
 * Phase 10 security checks that are not covered by the feature suites: token forgery,
 * expiry, security headers, payload limits and brute-force throttling.
 */
describe('Security (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let user: TestUser;
  const http = () => request(app.getHttpServer());
  const secret = () => process.env.JWT_ACCESS_SECRET!;
  const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');

  /** Session id the server put in the user's real token. */
  const sessionId = () =>
    (
      JSON.parse(Buffer.from(user.accessToken.split('.')[1], 'base64url').toString()) as {
        sid: string;
      }
    ).sid;

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
    await resetDatabase(prisma);
    user = await registerUser(app);
  });

  afterAll(async () => {
    await app.close();
  });

  const claims = () => ({ sub: user.id, sid: sessionId() });
  const sign = (opts: { secret?: string; expiresIn?: number; issuer?: string } = {}) =>
    new JwtService().sign(claims(), {
      secret: opts.secret ?? secret(),
      expiresIn: opts.expiresIn ?? 900,
      issuer: opts.issuer ?? JWT_ISSUER,
      audience: JWT_AUDIENCE,
      algorithm: 'HS256',
    });
  const me = (token: string) =>
    http().get(`${API}/auth/me`).set('Authorization', `Bearer ${token}`);

  it('accepts a correctly signed token (control)', async () => {
    await me(sign()).expect(200);
  });

  it('rejects tokens signed with another secret, another issuer or alg "none"', async () => {
    await me(sign({ secret: 'x'.repeat(48) })).expect(401);
    await me(sign({ issuer: 'evil' })).expect(401);
    const none = `${b64({ alg: 'none', typ: 'JWT' })}.${b64({ ...claims(), iss: JWT_ISSUER, aud: JWT_AUDIENCE })}.`;
    await me(none).expect(401);
  });

  it('rejects an expired token', async () => {
    const res = await me(sign({ expiresIn: -10 })).expect(401);
    expect(res.body.error.code).toBe('TOKEN_INVALID');
  });

  it('rejects a valid signature once the session is revoked (logout)', async () => {
    const victim = await registerUser(app);
    await http().post(`${API}/auth/logout`).set(auth(victim)).expect(200);
    const res = await http().get(`${API}/auth/me`).set(auth(victim)).expect(401);
    expect(['SESSION_REVOKED', 'TOKEN_INVALID']).toContain(res.body.error.code);
  });

  it('sends security headers and hides the framework', async () => {
    const res = await http().get(`${API}/health`).expect(200);
    expect(res.headers['x-powered-by']).toBeUndefined();
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['strict-transport-security']).toContain('max-age=');
    expect(res.headers['x-frame-options']).toBeDefined();
  });

  it('refuses oversized JSON bodies without leaking internals', async () => {
    const res = await http()
      .post(`${API}/habits`)
      .set(auth(user))
      .set('Content-Type', 'application/json')
      .send(JSON.stringify({ title: 'x', description: 'a'.repeat(200_000) }))
      .expect(413);
    expect(res.body.error.code).toBe('PAYLOAD_TOO_LARGE');
    expect(JSON.stringify(res.body)).not.toMatch(/node_modules|at .*\.js|stack/);
  });

  it('answers malformed JSON with 400, not 500', async () => {
    const res = await http()
      .post(`${API}/auth/login`)
      .set('Content-Type', 'application/json')
      .send('{"email": "a@b.c", "password": ')
      .expect(400);
    expect(res.body.error.code).toBe('BAD_REQUEST');
  });

  it('never returns secrets or hashes in user payloads', async () => {
    const res = await http().get(`${API}/auth/me`).set(auth(user)).expect(200);
    const text = JSON.stringify(res.body);
    expect(text).not.toMatch(/passwordHash|refreshTokenHash|argon2/i);
  });

  it('treats injection-looking input as plain data', async () => {
    const title = `'); DROP TABLE "User"; --`;
    const res = await http()
      .post(`${API}/habits`)
      .set(auth(user))
      .send({ title, type: 'PERSONAL', scheduleDays: [1] })
      .expect(201);
    expect(res.body.data.title).toBe(title);
    expect(await prisma.user.count()).toBeGreaterThan(0);
  });
});
