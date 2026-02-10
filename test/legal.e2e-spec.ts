// test/legal.e2e-spec.ts
import { INestApplication } from '@nestjs/common';
import mongoose from 'mongoose';
import request from 'supertest';

import { setupTestApp, teardownTestApp, type E2EContext } from './helpers/e2e';

jest.setTimeout(30000);

describe('legal (e2e)', () => {
  let app: INestApplication;
  let ctx: E2EContext;

  beforeAll(async () => {
    ctx = await setupTestApp({ useValidationPipe: true });
    app = ctx.app;
  });

  afterAll(async () => {
    await teardownTestApp(ctx, mongoose);
  });

  it('GET /legal/privacy returns policy text', async () => {
    const res = await request(app.getHttpServer()).get('/legal/privacy').expect(200);
    expect(typeof res.text).toBe('string');
    expect(res.text.length).toBeGreaterThan(10);
  });

  it('GET /legal/cookies returns notice text', async () => {
    const res = await request(app.getHttpServer()).get('/legal/cookies').expect(200);
    expect(typeof res.text).toBe('string');
    expect(res.text.length).toBeGreaterThan(10);
  });
});
