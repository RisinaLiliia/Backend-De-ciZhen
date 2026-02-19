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
  const prevPasswordResetReturnLink = process.env.PASSWORD_RESET_RETURN_LINK;
  const prevPasswordResetPath = process.env.PASSWORD_RESET_PATH;

  beforeAll(async () => {
    process.env.PASSWORD_RESET_RETURN_LINK = 'true';
    process.env.PASSWORD_RESET_PATH = '/auth/reset-password';

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
    process.env.PASSWORD_RESET_RETURN_LINK = prevPasswordResetReturnLink;
    process.env.PASSWORD_RESET_PATH = prevPasswordResetPath;
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

  it('forgot-password returns resetUrl for existing user and reset-password updates credentials', async () => {
    const email = 'auth-forgot@test.local';
    const oldPassword = 'Passw0rd!123';
    const newPassword = 'N3wPassw0rd!456';

    await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        name: 'Auth Forgot',
        email,
        password: oldPassword,
        role: 'client',
        acceptPrivacyPolicy: true,
      })
      .expect(201);

    const forgotRes = await request(app.getHttpServer())
      .post('/auth/forgot-password')
      .send({ email })
      .expect(200);

    expect(forgotRes.body?.ok).toBe(true);
    expect(typeof forgotRes.body?.resetUrl).toBe('string');

    const resetUrl = String(forgotRes.body.resetUrl);
    const token = new URL(resetUrl).searchParams.get('token');
    expect(token).toBeTruthy();

    await request(app.getHttpServer())
      .post('/auth/reset-password')
      .send({ token, password: newPassword })
      .expect(200)
      .expect({ ok: true });

    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password: oldPassword })
      .expect(401);

    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password: newPassword })
      .expect(200);
  });

  it('forgot-password for unknown email returns generic ok without resetUrl', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/forgot-password')
      .send({ email: 'auth-unknown@test.local' })
      .expect(200);

    expect(res.body).toEqual({ ok: true });
  });

  it('reset-password with invalid token returns 401', async () => {
    await request(app.getHttpServer())
      .post('/auth/reset-password')
      .send({ token: 'invalid-token', password: 'ValidPass1!' })
      .expect(401);
  });
});
