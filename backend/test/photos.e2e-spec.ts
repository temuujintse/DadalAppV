import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import { PrismaService } from '../src/database/prisma.service';
import { API, auth, createTestApp, registerUser, resetDatabase, TestUser } from './helpers';

/** Smallest valid images of each type (bytes are what the server checks). */
const PNG_1PX = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/iZk9HQAAAABJRU5ErkJggg==',
  'base64',
);
const JPEG_HEADER = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(200, 1)]);

describe('Profile photos (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const http = () => request(app.getHttpServer());
  let owner: TestUser;
  let child: TestUser;
  let stranger: TestUser;

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
    await resetDatabase(prisma);
    owner = await registerUser(app, { displayName: 'Ээж' });
    child = await registerUser(app, { displayName: 'Охин' });
    stranger = await registerUser(app);
    await http().post(`${API}/families`).set(auth(owner)).send({ name: 'Зурагтай' }).expect(201);
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
  });

  afterAll(async () => {
    await app.close();
  });

  const upload = (u: TestUser, image: string) =>
    http().put(`${API}/users/me/photo`).set(auth(u)).send({ image });

  it('uploads a photo and exposes a versioned URL everywhere the person appears', async () => {
    const res = await upload(child, PNG_1PX.toString('base64')).expect(200);
    const url = res.body.data.profile.photoUrl as string;
    expect(url).toMatch(new RegExp(`^/users/${child.id}/photo\\?v=\\d+$`));

    const members = await http()
      .get(`${API}/families/current/members`)
      .set(auth(owner))
      .expect(200);
    const me = members.body.data.find((m: { userId: string }) => m.userId === child.id);
    expect(me.photoUrl).toBe(url);
    const ownerRow = members.body.data.find((m: { userId: string }) => m.userId === owner.id);
    expect(ownerRow.photoUrl).toBeNull();
  });

  it('serves the bytes to the owner and family only, with caching headers', async () => {
    const mine = await http().get(`${API}/users/${child.id}/photo`).set(auth(child)).expect(200);
    expect(mine.headers['content-type']).toBe('image/png');
    expect(mine.headers['cache-control']).toContain('private');
    expect(Buffer.compare(mine.body as Buffer, PNG_1PX)).toBe(0);

    await http().get(`${API}/users/${child.id}/photo`).set(auth(owner)).expect(200);
    await http().get(`${API}/users/${child.id}/photo`).set(auth(stranger)).expect(404);
    await http().get(`${API}/users/${child.id}/photo`).expect(401);
    await http().get(`${API}/users/${owner.id}/photo`).set(auth(child)).expect(404); // no photo
  });

  it('detects the type from the bytes and rejects non-images and oversized files', async () => {
    const jpeg = await upload(
      owner,
      `data:image/jpeg;base64,${JPEG_HEADER.toString('base64')}`,
    ).expect(200);
    expect(jpeg.body.data.profile.photoUrl).not.toBeNull();
    const got = await http().get(`${API}/users/${owner.id}/photo`).set(auth(owner)).expect(200);
    expect(got.headers['content-type']).toBe('image/jpeg');

    const fake = await upload(
      owner,
      Buffer.from('<svg onload=alert(1)>').toString('base64'),
    ).expect(400);
    expect(fake.body.error.code).toBe('INVALID_IMAGE');

    const big = Buffer.concat([JPEG_HEADER, Buffer.alloc(66 * 1024)]).toString('base64');
    await upload(owner, big).expect(400); // over the DTO length limit
  });

  it('removes the photo and falls back to the preset avatar', async () => {
    const res = await http().delete(`${API}/users/me/photo`).set(auth(child)).expect(200);
    expect(res.body.data.profile.photoUrl).toBeNull();
    await http().get(`${API}/users/${child.id}/photo`).set(auth(child)).expect(404);
    expect(await prisma.userPhoto.count({ where: { userId: child.id } })).toBe(0);
  });
});
