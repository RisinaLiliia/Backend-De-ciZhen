// test/auth.e2e-spec.ts
import { INestApplication } from '@nestjs/common';
import mongoose from 'mongoose';
import request from 'supertest';

import { setupTestApp, teardownTestApp, type E2EContext } from './helpers/e2e';
import { RedisService } from '../src/infra/redis.service';

jest.setTimeout(30000);

describe('auth (e2e)', () => {
  let app: INestApplication;
  let ctx: E2EContext;

  beforeAll(async () => {
    const store = new Map<string, string>();
    const redisMock: Partial<RedisService> = {
      set: async (key: string, value: string) => {
        store.set(key, value);
      },
      get: async (key: string) => store.get(key) ?? null,
      del: async (key: string) => {
        store.delete(key);
      },
    };

    ctx = await setupTestApp({
      useValidationPipe: true,
      overrides: [{ token: RedisService, useValue: redisMock }],
    });
    app = ctx.app;
  });

  afterAll(async () => {
    await teardownTestApp(ctx, mongoose);
  });

  it('register sets refresh cookie and returns access token', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        name: 'Auth Register',
        email: 'auth-register@test.local',
        password: 'Passw0rd!123',
        role: 'client',
        acceptPrivacyPolicy: true,
      })
      .expect(201);

    expect(res.body?.accessToken).toBeTruthy();
    expect(res.headers['set-cookie']?.join(';') ?? '').toContain('refreshToken=');
  });

  it('login returns access token and sets refresh cookie', async () => {
    await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        name: 'Auth Login',
        email: 'auth-login@test.local',
        password: 'Passw0rd!123',
        role: 'client',
        acceptPrivacyPolicy: true,
      })
      .expect(201);

    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: 'auth-login@test.local',
        password: 'Passw0rd!123',
      })
      .expect(200);

    expect(res.body?.accessToken).toBeTruthy();
    expect(res.headers['set-cookie']?.join(';') ?? '').toContain('refreshToken=');
  });

  it('refresh rotates refresh cookie', async () => {
    const registerRes = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        name: 'Auth Refresh',
        email: 'auth-refresh@test.local',
        password: 'Passw0rd!123',
        role: 'client',
        acceptPrivacyPolicy: true,
      })
      .expect(201);

    const rawCookie = registerRes.headers['set-cookie']?.[0] ?? '';
    const cookie = rawCookie.split(';')[0];
    expect(cookie).toContain('refreshToken=');

    const res = await request(app.getHttpServer())
      .post('/auth/refresh')
      .set('Cookie', cookie)
      .expect(200);
    expect(res.body?.accessToken).toBeTruthy();
    expect(res.headers['set-cookie']?.join(';') ?? '').toContain('refreshToken=');
  });

  it('logout clears refresh cookie', async () => {
    const agent = request.agent(app.getHttpServer());

    await agent
      .post('/auth/register')
      .send({
        name: 'Auth Logout',
        email: 'auth-logout@test.local',
        password: 'Passw0rd!123',
        role: 'client',
        acceptPrivacyPolicy: true,
      })
      .expect(201);

    const res = await agent.post('/auth/logout').expect(200);
    expect(res.body).toEqual({ ok: true });
    expect(res.headers['set-cookie']?.join(';') ?? '').toContain('refreshToken=');
  });
});
