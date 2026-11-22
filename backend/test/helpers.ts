import { INestApplication } from '@nestjs/common';
import { Test, TestingModuleBuilder } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { PrismaService } from '../src/database/prisma.service';

export const API = '/api/v1';

export async function createTestApp(
  customize: (builder: TestingModuleBuilder) => TestingModuleBuilder = (b) => b,
): Promise<{
  app: INestApplication<App>;
  prisma: PrismaService;
}> {
  if (!process.env.DATABASE_URL?.includes('_test')) {
    throw new Error(
      'Refusing to run e2e tests against a non-test database (DATABASE_URL must contain "_test").',
    );
  }
  const moduleRef = await customize(Test.createTestingModule({ imports: [AppModule] })).compile();
  const app = moduleRef.createNestApplication<INestApplication<App>>();
  configureApp(app);
  await app.init();
  return { app, prisma: app.get(PrismaService) };
}

/** TRUNCATE skips row-level triggers, so the append-only ledger/audit tables can be cleared too. */
export async function resetDatabase(prisma: PrismaService): Promise<void> {
  const tables = await prisma.$queryRaw<Array<{ tablename: string }>>`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  if (tables.length === 0) return;
  await prisma.$executeRawUnsafe(
    `TRUNCATE ${tables.map((t) => `"${t.tablename}"`).join(', ')} RESTART IDENTITY CASCADE`,
  );
}

let counter = 0;

export interface TestUser {
  id: string;
  email: string;
  accessToken: string;
  refreshToken: string;
}

export async function registerUser(
  app: INestApplication<App>,
  overrides: Partial<{ email: string; displayName: string; password: string }> = {},
): Promise<TestUser> {
  counter += 1;
  const body = {
    email: overrides.email ?? `user${counter}-${Date.now()}@example.com`,
    password: overrides.password ?? 'secret123',
    displayName: overrides.displayName ?? `Хэрэглэгч ${counter}`,
  };
  const res = await request(app.getHttpServer())
    .post(`${API}/auth/register`)
    .send(body)
    .expect(201);
  return {
    id: res.body.data.user.id,
    email: res.body.data.user.email,
    accessToken: res.body.data.tokens.accessToken,
    refreshToken: res.body.data.tokens.refreshToken,
  };
}

export const auth = (user: TestUser) => ({ Authorization: `Bearer ${user.accessToken}` });
