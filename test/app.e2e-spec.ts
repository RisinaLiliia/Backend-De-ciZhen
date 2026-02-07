// test/app.e2e-spec.ts
import { INestApplication } from '@nestjs/common';
import mongoose from 'mongoose';
import request from 'supertest';
import { setupTestApp, teardownTestApp, type E2EContext } from './helpers/e2e';

jest.setTimeout(30000);

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

  it('/ (GET)', async () => {
    await request(app.getHttpServer()).get('/').expect(200).expect('Hello World!');
  });
});
