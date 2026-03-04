// test/app.e2e-spec.ts
import { INestApplication } from '@nestjs/common';
import mongoose from 'mongoose';
import request from 'supertest';
import { setupTestApp, teardownTestApp, type E2EContext } from './helpers/e2e';

jest.setTimeout(120000);

describe('AppController (e2e)', () => {
  let app: INestApplication;
  let ctx: E2EContext;

  beforeAll(async () => {
    ctx = await setupTestApp();
    app = ctx.app;
  });

  afterAll(async () => {
    await teardownTestApp(ctx, mongoose);
  });

  it('/health (GET)', async () => {
    await request(app.getHttpServer()).get('/health').expect(200).expect({ ok: true });
  });

  it('/health/live (GET)', async () => {
    const res = await request(app.getHttpServer()).get('/health/live').expect(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.status).toBe('live');
  });

  it('/health/ready (GET)', async () => {
    const res = await request(app.getHttpServer()).get('/health/ready').expect(200);
    expect(res.body.ok).toBe(true);
    expect(['ok', 'degraded']).toContain(res.body.status);
    expect(res.body.mongo?.ready).toBe(true);
  });

  it('/ (GET)', async () => {
    await request(app.getHttpServer()).get('/').expect(200).expect('Hello World!');
  });
});
